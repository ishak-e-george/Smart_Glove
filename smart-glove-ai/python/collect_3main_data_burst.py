#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import statistics
import time
from pathlib import Path
from typing import Optional

import serial

FEATURES_3MAIN = ["indexPercent", "middlePercent", "ringPercent"]

PERCENT_INDEX = {
    "index": 0,
    "middle": 1,
    "ring": 2,
}

GATES = {
    "REST": {
        "max": {"index": 40, "middle": 40, "ring": 45},
    },
    "INDEX_BENT": {
        "min": {"index": 60},
        "max": {"middle": 40, "ring": 45},
    },
    "MIDDLE_BENT": {
        "min": {"middle": 60},
        "max": {"ring": 45},
    },
    "RING_BENT": {
        "min": {"ring": 60},
        "max": {"middle": 55},
    },
    "INDEX_MIDDLE_BENT": {
        "min": {"index": 60, "middle": 60},
        "max": {"ring": 45},
    },
    "INDEX_RING_BENT": {
        "min": {"index": 60, "ring": 60},
        "max": {"middle": 40},
    },
    "MIDDLE_RING_BENT": {
        "min": {"middle": 60, "ring": 60},
    },
    "ALL_THREE_BENT": {
        "min": {"index": 60, "middle": 60, "ring": 60},
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect burst-median 3-main-finger rows from a Smart Glove percent stream."
    )
    parser.add_argument("--port", default="COM4")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--label", required=True, choices=sorted(GATES.keys()))
    parser.add_argument("--rows", type=int, default=150)
    parser.add_argument(
        "--output",
        default="data/raw/smart_glove_3main_dataset.csv",
        help="CSV output path",
    )
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--burst", type=int, default=9)
    parser.add_argument("--warmup", type=float, default=1.0)
    parser.add_argument("--max-rejected", type=int, default=2000)
    return parser.parse_args()


def parse_stream_row(line: str) -> Optional[list[int]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    parts = [part.strip() for part in line.split(",")]
    try:
        values = [int(float(part)) for part in parts]
    except ValueError:
        return None

    if len(values) == 5:
        return values[:3]

    if len(values) == 15:
        return [values[2], values[5], values[8]]

    return None


def median_row(rows: list[list[int]]) -> list[int]:
    columns = list(zip(*rows))
    return [int(round(statistics.median(column))) for column in columns]


def read_burst(connection: serial.Serial, burst: int) -> Optional[list[int]]:
    rows: list[list[int]] = []
    deadline = time.time() + 3.0

    while len(rows) < burst and time.time() < deadline:
        line = connection.readline().decode("utf-8", errors="ignore")
        row = parse_stream_row(line)
        if row is not None:
            rows.append(row)

    if len(rows) < max(3, burst // 2):
        return None

    return median_row(rows)


def percents(row: list[int]) -> dict[str, int]:
    return {name: row[index] for name, index in PERCENT_INDEX.items()}


def gate_row(label: str, row: list[int]) -> tuple[bool, str]:
    values = percents(row)
    gate = GATES[label]

    for name, minimum in gate.get("min", {}).items():
        if values[name] < minimum:
            return False, f"{name}Percent={values[name]} below min {minimum}"

    for name, maximum in gate.get("max", {}).items():
        if values[name] > maximum:
            return False, f"{name}Percent={values[name]} above max {maximum}"

    return True, "ok"


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
    print("This collector saves only index/middle/ring percent features and ignores pinky/thumb.")
    print("Make the gesture, hold it steady, then press Enter.")
    input()

    accepted = 0
    rejected = 0

    with serial.Serial(args.port, args.baud, timeout=1) as connection, output.open(
        mode,
        newline="",
        encoding="utf-8",
    ) as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(["label", *FEATURES_3MAIN])

        time.sleep(2.0)
        connection.reset_input_buffer()

        print("Sending Arduino command: snap")
        try:
            connection.write(b"snap\n")
        except Exception:
            pass

        print(f"Warming up for {args.warmup:.1f} seconds...")
        start = time.time()
        while time.time() - start < args.warmup:
            connection.readline()

        print("Keep the gesture steady until collection finishes.")

        while accepted < args.rows:
            row = read_burst(connection, args.burst)
            if row is None:
                continue

            ok, reason = gate_row(args.label, row)
            percent_values = row

            if not ok:
                rejected += 1
                if rejected == 1 or rejected % 25 == 0:
                    print(f"Rejected {rejected}: percents={percent_values} reason={reason}")
                if rejected >= args.max_rejected:
                    print(f"Stopped: too many rejected bursts ({rejected}).")
                    return 2
                continue

            writer.writerow([args.label, *row])
            accepted += 1

            if accepted == 1 or accepted % 25 == 0 or accepted == args.rows:
                print(f"[{accepted:3d}/{args.rows}] percents={percent_values}")

    print(f"Saved {accepted} median rows to {output.resolve()}")
    print(f"Rejected bursts: {rejected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
