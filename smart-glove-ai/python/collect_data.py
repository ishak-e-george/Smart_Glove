from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import serial

from common import DEFAULT_BAUD_RATE, DEFAULT_FEATURE_SET, append_dataset_rows, parse_sensor_line


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect labeled smart glove samples from Arduino serial output."
    )
    parser.add_argument("--port", required=True, help="Serial port, for example COM5")
    parser.add_argument("--label", required=True, help="Gesture label to write")
    parser.add_argument(
        "--samples",
        type=int,
        default=100,
        help="Number of valid rows to collect for this label",
    )
    parser.add_argument(
        "--baud",
        type=int,
        default=DEFAULT_BAUD_RATE,
        help="Serial baud rate",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "gesture_dataset.csv",
        help="Dataset CSV path",
    )
    parser.add_argument(
        "--warmup-seconds",
        type=float,
        default=2.0,
        help="Seconds to ignore serial data before recording",
    )
    parser.add_argument(
        "--preview-every",
        type=int,
        default=10,
        help="Print one preview row every N captured samples",
    )
    parser.add_argument(
        "--feature-set",
        choices=["2", "3", "5"],
        default=DEFAULT_FEATURE_SET,
        help="Number of fingers included in the serial CSV stream",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    label = args.label.strip().upper()
    captured_rows: list[dict[str, object]] = []

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Label: {label}")
    print(f"Target samples: {args.samples}")
    print("Hold the gesture, but vary pressure, angle, and bend slightly while recording.")
    input("Press Enter when ready to start capture...")

    with serial.Serial(args.port, args.baud, timeout=1) as connection:
        connection.reset_input_buffer()
        print(f"Warming up for {args.warmup_seconds:.1f} seconds...")
        time.sleep(args.warmup_seconds)

        while len(captured_rows) < args.samples:
            raw_line = connection.readline().decode("utf-8", errors="ignore")
            parsed = parse_sensor_line(raw_line, feature_set=args.feature_set)
            if parsed is None:
                continue

            parsed["label"] = label
            captured_rows.append(parsed)

            if len(captured_rows) == 1 or len(captured_rows) % args.preview_every == 0:
                print(f"[{len(captured_rows):>3}/{args.samples}] {parsed}")

    append_dataset_rows(args.csv, captured_rows, feature_set=args.feature_set)
    print(f"Saved {len(captured_rows)} rows to {args.csv}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
