#!/usr/bin/env python3
"""
Burst-median 5-finger Smart Glove data collector.

This is for noisy live glove signals.
Instead of saving/rejecting every single serial row, it reads a small burst
(e.g. 9 rows), takes the median of each column, then applies gesture gates.

Why it helps:
- If Pinky randomly jumps to 100 for one row, the median usually ignores it.
- If Ring/Middle briefly spike, the median reduces contamination.
- It still rejects truly unstable or wrong gestures.

Run examples:
    python python/collect_5f_data_burst.py --port COM4 --label INDEX_BENT --rows 150
    python python/collect_5f_data_burst.py --port COM4 --label OPEN --rows 150 --overwrite
"""

from __future__ import annotations

import argparse
import csv
import statistics
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

# Practical gates for your current glove.
# These are slightly more tolerant than strict mode, but still reject bad contamination.
GATES = {
    "OPEN": {
        "max": {"index": 40, "middle": 40, "ring": 45, "pinky": 65, "thumb": 40},
    },
    "INDEX_BENT": {
        "min": {"index": 50},
        "max": {"middle": 60, "ring": 70, "pinky": 75, "thumb": 50},
    },
    "MIDDLE_BENT": {
        "min": {"middle": 55},
        "max": {"index": 55, "ring": 70, "pinky": 75, "thumb": 50},
    },
    "RING_BENT": {
        "min": {"ring": 55},
        "max": {"index": 55, "middle": 65, "pinky": 80, "thumb": 55},
    },
    "PINKY_BENT": {
        "min": {"pinky": 65},
        # Pinky naturally pulls ring. Allow ring higher.
        "max": {"index": 55, "middle": 65, "ring": 85, "thumb": 55},
    },
    "THUMB_BENT": {
        "min": {"thumb": 55},
        "max": {"index": 55, "middle": 65, "ring": 75, "pinky": 85},
    },
    "FIST": {
        # Based on your real fist pattern: ring may remain low.
        "min": {"index": 60, "middle": 60, "pinky": 70, "thumb": 55},
    },
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--port", default="COM4")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument("--label", required=True, choices=sorted(GATES.keys()))
    p.add_argument("--rows", type=int, default=150)
    p.add_argument("--output", default="data/raw/smart_glove_5f_dataset.csv")
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--burst", type=int, default=9, help="Number of rows per median burst")
    p.add_argument("--warmup", type=float, default=1.0)
    p.add_argument("--max-rejected", type=int, default=1500)
    return p.parse_args()


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


def median_row(rows: List[List[int]]) -> List[int]:
    cols = list(zip(*rows))
    return [int(round(statistics.median(col))) for col in cols]


def percents(row: List[int]) -> Dict[str, int]:
    return {name: int(row[idx]) for name, idx in PERCENT_INDEX.items()}


def gate_row(label: str, row: List[int]) -> Tuple[bool, str]:
    p = percents(row)
    gate = GATES[label]

    for name, minimum in gate.get("min", {}).items():
        if p[name] < minimum:
            return False, f"{name}Percent={p[name]} below min {minimum}"

    for name, maximum in gate.get("max", {}).items():
        if p[name] > maximum:
            return False, f"{name}Percent={p[name]} above max {maximum}"

    return True, "ok"


def read_burst(ser: serial.Serial, burst: int) -> Optional[List[int]]:
    rows: List[List[int]] = []
    deadline = time.time() + 3.0

    while len(rows) < burst and time.time() < deadline:
        line = ser.readline().decode("utf-8", errors="ignore")
        row = parse_row(line)
        if row is not None:
            rows.append(row)

    if len(rows) < max(3, burst // 2):
        return None

    return median_row(rows)


def main() -> int:
    args = parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    mode = "w" if args.overwrite or not output.exists() else "a"
    write_header = mode == "w"

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Label: {args.label}")
    print(f"Target accepted rows: {args.rows}")
    print(f"Burst median size: {args.burst}")
    print("Make the gesture, hold it steady, and press Enter.")
    input()

    accepted = 0
    rejected = 0

    with serial.Serial(args.port, args.baud, timeout=1) as ser, output.open(mode, newline="", encoding="utf-8") as f:
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
        start = time.time()
        while time.time() - start < args.warmup:
            ser.readline()

        print("Keep the gesture steady until collection finishes.")

        while accepted < args.rows:
            row = read_burst(ser, args.burst)
            if row is None:
                continue

            ok, reason = gate_row(args.label, row)
            p = [row[i] for i in [2, 5, 8, 11, 14]]

            if not ok:
                rejected += 1
                if rejected == 1 or rejected % 25 == 0:
                    print(f"Rejected {rejected}: percents={p} reason={reason}")
                if rejected >= args.max_rejected:
                    print(f"Stopped: too many rejected bursts ({rejected}).")
                    return 2
                continue

            writer.writerow([args.label] + row)
            accepted += 1

            if accepted == 1 or accepted % 25 == 0 or accepted == args.rows:
                print(f"[{accepted:3d}/{args.rows}] percents={p}")

    print(f"Saved {accepted} median rows to {output.resolve()}")
    print(f"Rejected bursts: {rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
