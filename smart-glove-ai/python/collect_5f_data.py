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
VALID_LABELS = {
    "OPEN",
    "INDEX_BENT",
    "MIDDLE_BENT",
    "RING_BENT",
    "PINKY_BENT",
    "THUMB_BENT",
    "FIST",
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect labeled 5-finger Smart Glove rows from Arduino serial output."
    )
    parser.add_argument("--port", default="COM4", help="Serial port, for example COM4")
    parser.add_argument("--label", required=True, help="Gesture label to collect")
    parser.add_argument("--rows", type=int, default=200, help="Number of valid rows to collect")
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
        "--warmup-seconds",
        type=float,
        default=1.0,
        help="Seconds to ignore serial rows before recording",
    )
    parser.add_argument(
        "--preview-every",
        type=int,
        default=25,
        help="Print one preview row every N captured rows",
    )
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="Start immediately without waiting for Enter",
    )
    return parser


def ensure_csv(csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if csv_path.exists() and csv_path.stat().st_size > 0:
        return

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()


def append_rows(csv_path: Path, rows: list[dict[str, object]]) -> None:
    ensure_csv(csv_path)
    with csv_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writerows(rows)


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

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Label: {label}")
    print(f"Target rows: {args.rows}")
    print("Use only status/snap on the Arduino. Hold the gesture steady before capture.")

    if not args.no_prompt:
        input("Make the gesture, send snap, wait 1 second, then press Enter...")

    captured_rows: list[dict[str, object]] = []

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as connection:
            connection.reset_input_buffer()
            print(f"Warming up for {args.warmup_seconds:.1f} seconds...")
            time.sleep(args.warmup_seconds)

            while len(captured_rows) < args.rows:
                raw_line = connection.readline().decode("utf-8", errors="ignore")
                parsed = parse_sensor_line(raw_line, feature_set=FEATURE_SET)
                if parsed is None:
                    continue

                row = {"label": label, **parsed}
                captured_rows.append(row)

                count = len(captured_rows)
                if count == 1 or count % args.preview_every == 0 or count == args.rows:
                    percentages = [
                        row["indexPercent"],
                        row["middlePercent"],
                        row["ringPercent"],
                        row["pinkyPercent"],
                        row["thumbPercent"],
                    ]
                    print(f"[{count:>3}/{args.rows}] percents={percentages}")
    except serial.SerialException as exc:
        print(f"Could not open/read serial port {args.port}: {exc}", file=sys.stderr)
        return 1

    append_rows(args.csv, captured_rows)
    print(f"Saved {len(captured_rows)} rows to {args.csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
