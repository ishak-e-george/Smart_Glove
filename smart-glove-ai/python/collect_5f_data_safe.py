from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

import serial

from common import DEFAULT_BAUD_RATE, get_feature_columns, parse_sensor_line

FEATURE_SET = "5"
FEATURE_COLUMNS = get_feature_columns(FEATURE_SET)
CSV_COLUMNS = ["label", *FEATURE_COLUMNS]

PERCENT_COLUMNS = [
    "indexPercent",
    "middlePercent",
    "ringPercent",
    "pinkyPercent",
    "thumbPercent",
]

VALID_LABELS = {
    "OPEN",
    "INDEX_BENT",
    "MIDDLE_BENT",
    "RING_BENT",
    "PINKY_BENT",
    "THUMB_BENT",
    "FIST",
}

TARGET_PERCENT_BY_LABEL = {
    "INDEX_BENT": "indexPercent",
    "MIDDLE_BENT": "middlePercent",
    "RING_BENT": "ringPercent",
    "PINKY_BENT": "pinkyPercent",
    "THUMB_BENT": "thumbPercent",
}

OPEN_MAX_PERCENT = {
    "indexPercent": 35,
    "middlePercent": 35,
    "ringPercent": 40,
    "pinkyPercent": 60,
    "thumbPercent": 35,
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safely collect labeled 5-finger Smart Glove rows from Arduino serial output."
    )
    parser.add_argument("--port", default="COM4", help="Serial port, for example COM4")
    parser.add_argument("--label", required=True, help="Gesture label to collect")
    parser.add_argument("--rows", type=int, default=200, help="Number of accepted rows to collect")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD_RATE, help="Serial baud rate")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "data"
        / "raw"
        / "smart_glove_5f_dataset.csv",
        help="Output raw dataset CSV path",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace the output CSV before writing this label.",
    )
    parser.add_argument(
        "--snap-command",
        default="snap",
        help="Arduino command sent before capture starts.",
    )
    parser.add_argument(
        "--settle-seconds",
        type=float,
        default=1.0,
        help="Seconds to wait after sending snap before recording rows.",
    )
    parser.add_argument(
        "--target-min",
        type=int,
        default=55,
        help="Minimum target finger percent accepted for single-finger bent labels.",
    )
    parser.add_argument(
        "--fist-min-fingers",
        type=int,
        default=4,
        help="Minimum number of fingers that must be above --target-min for FIST.",
    )
    parser.add_argument(
        "--preview-every",
        type=int,
        default=25,
        help="Print one preview row every N accepted rows.",
    )
    parser.add_argument(
        "--max-rejected",
        type=int,
        default=2000,
        help="Stop if too many rows are rejected before reaching the target.",
    )
    return parser


def ensure_csv(csv_path: Path, overwrite: bool) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if overwrite and csv_path.exists():
        csv_path.unlink()

    if csv_path.exists() and csv_path.stat().st_size > 0:
        return

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()


def append_rows(csv_path: Path, rows: list[dict[str, object]]) -> None:
    with csv_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writerows(rows)


def get_percents(row: dict[str, int]) -> list[int]:
    return [row[column] for column in PERCENT_COLUMNS]


def validate_row(label: str, row: dict[str, int], target_min: int, fist_min_fingers: int) -> str | None:
    for column in PERCENT_COLUMNS:
        value = row[column]
        if value < 0 or value > 100:
            return f"{column} outside 0-100: {value}"

    if label == "OPEN":
        failures = [
            f"{column}={row[column]}>{maximum}"
            for column, maximum in OPEN_MAX_PERCENT.items()
            if row[column] > maximum
        ]
        if failures:
            return "OPEN threshold failed: " + ", ".join(failures)
        return None

    if label == "FIST":
        bent_count = sum(1 for column in PERCENT_COLUMNS if row[column] >= target_min)
        if bent_count < fist_min_fingers:
            return f"FIST needs {fist_min_fingers} fingers >= {target_min}; got {bent_count}"
        return None

    target_column = TARGET_PERCENT_BY_LABEL.get(label)
    if target_column and row[target_column] < target_min:
        return f"{target_column}={row[target_column]} below target min {target_min}"

    return None


def main() -> int:
    args = build_arg_parser().parse_args()
    label = args.label.strip().upper()

    if label not in VALID_LABELS:
        print(f"Unsupported label: {label}", file=sys.stderr)
        print(f"Valid labels: {', '.join(sorted(VALID_LABELS))}", file=sys.stderr)
        return 1

    if args.rows <= 0:
        print("--rows must be greater than zero", file=sys.stderr)
        return 1

    ensure_csv(args.csv, overwrite=args.overwrite)

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Label: {label}")
    print(f"Target accepted rows: {args.rows}")
    print(f"Sending Arduino command: {args.snap_command}")
    print("Keep the gesture steady until collection finishes.")

    accepted_rows: list[dict[str, object]] = []
    rejected_count = 0
    last_reject_reason = ""

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as connection:
            connection.reset_input_buffer()
            connection.write((args.snap_command.strip() + "\n").encode("utf-8"))
            connection.flush()
            time.sleep(args.settle_seconds)
            connection.reset_input_buffer()

            while len(accepted_rows) < args.rows:
                raw_line = connection.readline().decode("utf-8", errors="ignore")
                parsed = parse_sensor_line(raw_line, feature_set=FEATURE_SET)
                if parsed is None:
                    continue

                reject_reason = validate_row(
                    label,
                    parsed,
                    target_min=args.target_min,
                    fist_min_fingers=args.fist_min_fingers,
                )
                if reject_reason is not None:
                    rejected_count += 1
                    last_reject_reason = reject_reason
                    if rejected_count == 1 or rejected_count % 50 == 0:
                        print(
                            f"Rejected {rejected_count}: percents={get_percents(parsed)} "
                            f"reason={reject_reason}"
                        )
                    if rejected_count >= args.max_rejected:
                        print(
                            f"Stopped after {rejected_count} rejected rows. "
                            f"Last reason: {last_reject_reason}",
                            file=sys.stderr,
                        )
                        return 1
                    continue

                row = {"label": label, **parsed}
                accepted_rows.append(row)

                count = len(accepted_rows)
                if count == 1 or count % args.preview_every == 0 or count == args.rows:
                    print(f"[{count:>3}/{args.rows}] percents={get_percents(parsed)}")
    except serial.SerialException as exc:
        print(f"Could not open/read serial port {args.port}: {exc}", file=sys.stderr)
        return 1

    append_rows(args.csv, accepted_rows)
    print(f"Saved {len(accepted_rows)} rows to {args.csv}")
    print(f"Rejected rows: {rejected_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
