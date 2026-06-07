#!/usr/bin/env python3
"""
5-Finger Smart Glove word/phrase data collector.

Expected Arduino CSV:
indexPercent,middlePercent,ringPercent,pinkyPercent,thumbPercent

Example:
100,0,0,0,0

Usage:
python python/collect_5finger_word_data.py --port COM4 --label HELLO --phrase "Hello" --rows 100
"""

from __future__ import annotations

import argparse
import csv
import os
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import serial
except ImportError:
    print("Missing dependency: pyserial. Install with: pip install pyserial")
    sys.exit(1)


FEATURES = ["index", "middle", "ring", "pinky", "thumb"]

# Demo vocabulary gates.
# These are intentionally practical for live demo training, not strict sign-language validation.
# The collector accepts a row when the target finger(s) are clearly active.
# REST stays strict because bad REST data hurts the model.
GATES = {
    "REST": {
        "max": {"index": 35, "middle": 35, "ring": 35, "pinky": 35},
    },
    "HELLO": {          # Index
        "min": {"index": 60},
        "max": {"middle": 60, "ring": 70},
    },
    "YES": {            # Middle
        "min": {"middle": 50},
        "max": {"ring": 70},
    },
    "NO": {             # Ring
        "min": {"ring": 60},
        "max": {"middle": 65},
    },
    "THANK_YOU": {      # Pinky
        "min": {"pinky": 60},
    },
    "HELP": {           # Thumb
        "min": {"thumb": 60},
    },
    "PLEASE": {         # Index + Middle
        "min": {"index": 60, "middle": 50},
    },
    "WATER": {          # Index + Ring
        "min": {"index": 60, "ring": 60},
    },
    "ASSISTANCE": {     # All five / emergency phrase
        "min": {"index": 50, "middle": 50, "ring": 50, "pinky": 50, "thumb": 50},
    },
}


DEFAULT_PHRASES = {
    "REST": "",
    "HELLO": "Hello",
    "YES": "Yes",
    "NO": "No",
    "THANK_YOU": "Thank you",
    "HELP": "I need help",
    "PLEASE": "Please",
    "WATER": "I want water",
    "ASSISTANCE": "I need assistance",
}


def parse_percent_line(line: str) -> list[int] | None:
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 5:
        return None

    try:
        values = [int(float(p)) for p in parts[:5]]
    except ValueError:
        return None

    values = [max(0, min(100, v)) for v in values]
    return values


def median_burst(ser: serial.Serial, burst_size: int, timeout_s: float) -> list[int] | None:
    rows: list[list[int]] = []
    deadline = time.time() + timeout_s

    while time.time() < deadline and len(rows) < burst_size:
        raw = ser.readline().decode(errors="ignore")
        parsed = parse_percent_line(raw)
        if parsed is not None:
            rows.append(parsed)

    if not rows:
        return None

    return [int(round(statistics.median([row[i] for row in rows]))) for i in range(5)]


def validate(label: str, values: list[int]) -> tuple[bool, str]:
    gate = GATES.get(label)
    if gate is None:
        # Unknown labels are allowed, but no quality gate is applied.
        return True, "no gate for custom label"

    data = dict(zip(FEATURES, values))

    for name, minimum in gate.get("min", {}).items():
        if data[name] < minimum:
            return False, f"{name}Percent={data[name]} below min {minimum}"

    for name, maximum in gate.get("max", {}).items():
        if data[name] > maximum:
            return False, f"{name}Percent={data[name]} above max {maximum}"

    return True, "ok"


def ensure_header(path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", *FEATURES, "label", "phrase"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True, help="Arduino serial port, e.g. COM4")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--label", required=True, help="Word label, e.g. HELLO")
    parser.add_argument("--phrase", default=None, help="Spoken phrase. Defaults based on label.")
    parser.add_argument("--rows", type=int, default=100)
    parser.add_argument("--burst", type=int, default=9, help="Median burst size")
    parser.add_argument("--warmup", type=float, default=1.0)
    parser.add_argument("--out", default="data/raw/smart_glove_5word_dataset.csv")
    parser.add_argument("--no-gate", action="store_true", help="Save rows without validation gate")
    parser.add_argument("--max-rejects", type=int, default=1200)
    args = parser.parse_args()

    label = args.label.upper().strip()
    phrase = args.phrase if args.phrase is not None else DEFAULT_PHRASES.get(label, label.replace("_", " ").title())

    out_path = Path(args.out)
    ensure_header(out_path)

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Label: {label}")
    print(f"Phrase: {phrase!r}")
    print(f"Target accepted rows: {args.rows}")
    print(f"Burst median size: {args.burst}")
    print(f"Output: {out_path}")
    print()
    print("Make the gesture, hold it steady, then press Enter.")
    input()

    accepted = 0
    rejected = 0

    with serial.Serial(args.port, args.baud, timeout=1) as ser:
        time.sleep(2.0)
        ser.reset_input_buffer()

        print("Sending Arduino command: snap")
        ser.write(b"snap\n")
        ser.flush()

        print(f"Warming up for {args.warmup:.1f} seconds...")
        time.sleep(args.warmup)
        ser.reset_input_buffer()

        print("Keep the gesture steady until collection finishes.")

        with out_path.open("a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)

            while accepted < args.rows:
                values = median_burst(ser, args.burst, timeout_s=3.0)
                if values is None:
                    rejected += 1
                    if rejected % 25 == 0:
                        print(f"Rejected {rejected}: no valid CSV lines")
                    if rejected >= args.max_rejects:
                        print("Too many rejects. Stop and check the glove/gesture.")
                        return 2
                    continue

                ok, reason = (True, "no gate") if args.no_gate else validate(label, values)

                if ok:
                    writer.writerow([datetime.now().isoformat(timespec="seconds"), *values, label, phrase])
                    accepted += 1
                    if accepted == 1 or accepted % 25 == 0 or accepted == args.rows:
                        print(f"[{accepted:3d}/{args.rows}] percents={values}")
                else:
                    rejected += 1
                    if rejected == 1 or rejected % 25 == 0:
                        print(f"Rejected {rejected}: percents={values} reason={reason}")
                    if rejected >= args.max_rejects:
                        print("Too many rejects. Stop and check the glove/gesture or use --no-gate for a controlled demo.")
                        return 2

    print(f"Saved {accepted} rows to {out_path.resolve()}")
    print(f"Rejected bursts: {rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
