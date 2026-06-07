#!/usr/bin/env python3
"""
Strict 5-finger Smart Glove data collector.

Use this when collecting single-finger gestures. It rejects rows where the target
finger is bent BUT other fingers are also too high, because that contaminates the
label.

Example:
    python python/collect_5f_data_strict.py --port COM4 --label INDEX_BENT --rows 150

Reset one bad label first:
    python python/remove_label_rows.py --label INDEX_BENT
"""

from __future__ import annotations

import argparse
import csv
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import serial


FEATURES = [
    "indexRaw", "indexSmooth", "indexPercent",
    "middleRaw", "middleSmooth", "middlePercent",
    "ringRaw", "ringSmooth", "ringPercent",
    "pinkyRaw", "pinkySmooth", "pinkyPercent",
    "thumbRaw", "thumbSmooth", "thumbPercent",
]

PERCENT_INDEX = {
    "index": 2,
    "middle": 5,
    "ring": 8,
    "pinky": 11,
    "thumb": 14,
}

# Thresholds tuned for your current live-locked firmware.
# For single-finger labels:
# - target finger must be clearly bent
# - other fingers must stay below non-target limits
GATES = {
    "OPEN": {
        "max": {"index": 35, "middle": 35, "ring": 40, "pinky": 60, "thumb": 35},
    },
    "INDEX_BENT": {
        "min": {"index": 55},
        "max": {"middle": 45, "ring": 50, "pinky": 60, "thumb": 40},
    },
    "MIDDLE_BENT": {
        "min": {"middle": 55},
        "max": {"index": 45, "ring": 50, "pinky": 60, "thumb": 40},
    },
    "RING_BENT": {
        "min": {"ring": 55},
        "max": {"index": 45, "middle": 50, "pinky": 70, "thumb": 45},
    },
    "PINKY_BENT": {
        "min": {"pinky": 65},
        # ring coupling is common with pinky; allow ring a bit higher.
        "max": {"index": 45, "middle": 50, "ring": 75, "thumb": 45},
    },
    "THUMB_BENT": {
        "min": {"thumb": 55},
        "max": {"index": 45, "middle": 50, "ring": 55, "pinky": 70},
    },
    "FIST": {
        # Your live fist may show ring near 0, so ring is not required.
        "min": {"index": 60, "middle": 60, "pinky": 70, "thumb": 55},
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default="COM4")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--label", required=True, choices=sorted(GATES.keys()))
    parser.add_argument("--rows", type=int, default=150)
    parser.add_argument(
        "--output",
        default="data/raw/smart_glove_5f_dataset.csv",
        help="CSV output path",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite output file instead of appending",
    )
    parser.add_argument(
        "--max-rejected",
        type=int,
        default=4000,
        help="Stop if too many bad rows are rejected",
    )
    parser.add_argument(
        "--warmup",
        type=float,
        default=1.0,
        help="Seconds to ignore rows after snap",
    )
    return parser.parse_args()


def parse_row(line: str) -> Optional[List[int]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    parts = [p.strip() for p in line.split(",")]
    if len(parts) != 15:
        return None

    try:
        return [int(float(p)) for p in parts]
    except ValueError:
        return None


def percents(row: List[int]) -> Dict[str, int]:
    return {name: int(row[idx]) for name, idx in PERCENT_INDEX.items()}


def gate_row(label: str, row: List[int]) -> Tuple[bool, str]:
    p = percents(row)
    gate = GATES[label]

    for name, minimum in gate.get("min", {}).items():
        if p[name] < minimum:
            return False, f"{name}Percent={p[name]} below target min {minimum}"

    for name, maximum in gate.get("max", {}).items():
        if p[name] > maximum:
            return False, f"{name}Percent={p[name]} above allowed max {maximum}"

    return True, "ok"


def ensure_output(path: Path, overwrite: bool) -> Tuple[bool, str]:
    path.parent.mkdir(parents=True, exist_ok=True)

    if overwrite or not path.exists():
        return True, "w"

    return False, "a"


def main() -> int:
    args = parse_args()
    out_path = Path(args.output)
    write_header, mode = ensure_output(out_path, args.overwrite)

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Label: {args.label}")
    print(f"Target rows: {args.rows}")
    print("STRICT mode: target must be bent and non-target fingers must stay low.")
    print("Make the gesture, hold it steady, and press Enter.")
    input()

    accepted = 0
    rejected = 0

    with serial.Serial(args.port, args.baud, timeout=1) as ser, out_path.open(mode, newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        if write_header:
            writer.writerow(["label"] + FEATURES)

        time.sleep(2.0)
        ser.reset_input_buffer()

        print("Sending Arduino command: snap")
        try:
            ser.write(b"snap\n")
        except Exception:
            pass

        print(f"Warming up for {args.warmup:.1f} seconds...")
        start_warmup = time.time()
        while time.time() - start_warmup < args.warmup:
            ser.readline()

        print("Keep the gesture steady until collection finishes.")

        while accepted < args.rows:
            line = ser.readline().decode("utf-8", errors="ignore")
            row = parse_row(line)
            if row is None:
                continue

            ok, reason = gate_row(args.label, row)
            p = [row[i] for i in [2, 5, 8, 11, 14]]

            if not ok:
                rejected += 1
                if rejected == 1 or rejected % 50 == 0:
                    print(f"Rejected {rejected}: percents={p} reason={reason}")
                if rejected >= args.max_rejected:
                    print(f"Stopped: too many rejected rows ({rejected}).")
                    print("This means the gesture is not stable enough under strict rules.")
                    return 2
                continue

            writer.writerow([args.label] + row)
            accepted += 1

            if accepted == 1 or accepted % 25 == 0 or accepted == args.rows:
                print(f"[{accepted:3d}/{args.rows}] percents={p}")

    print(f"Saved {accepted} rows to {out_path.resolve()}")
    print(f"Rejected rows: {rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
