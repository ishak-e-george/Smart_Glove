from __future__ import annotations

import argparse
import math
import queue
import statistics
import sys
import threading
import time
from collections import defaultdict

import serial

from common import DEFAULT_BAUD_RATE, DEFAULT_FEATURE_SET, get_feature_columns, parse_sensor_line

FINGER_LABELS = {
    "2": ["INDEX", "MIDDLE"],
    "3": ["INDEX", "MIDDLE", "RING"],
    "5": ["INDEX", "MIDDLE", "RING", "PINKY", "THUMB"],
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Check sensor stability and percent quality before dataset collection."
    )
    parser.add_argument("--port", required=True, help="Serial port, for example COM4")
    parser.add_argument(
        "--baud",
        type=int,
        default=DEFAULT_BAUD_RATE,
        help="Serial baud rate",
    )
    parser.add_argument(
        "--seconds",
        type=float,
        default=10.0,
        help="How long to sample serial data",
    )
    parser.add_argument(
        "--feature-set",
        choices=["2", "3", "5"],
        default=DEFAULT_FEATURE_SET,
        help="Number of fingers included in the serial CSV stream",
    )
    return parser


def summarize(values: list[int]) -> tuple[float, float, int, int]:
    mean_value = statistics.fmean(values)
    std_value = statistics.pstdev(values) if len(values) > 1 else 0.0
    return mean_value, std_value, min(values), max(values)


def assess_percent_quality(min_value: int, max_value: int, std_value: float, invalid_count: int) -> str:
    if invalid_count > 0:
        return "WARN percent=-1 seen"
    if max_value >= 60:
        return "WARN rest too high"
    if std_value > 10:
        return "WARN noisy"
    return "OK"


def assess_range(range_value: int) -> str:
    if range_value < 80:
        return "BAD"
    if range_value < 120:
        return "WEAK"
    if range_value < 150:
        return "USABLE"
    return "GOOD"


def serial_reader_thread(
    connection: serial.Serial,
    feature_set: str,
    output_queue: queue.Queue[tuple[str, dict[str, int] | None]],
    stop_event: threading.Event,
) -> None:
    while not stop_event.is_set():
        try:
            raw_line = connection.readline().decode("utf-8", errors="ignore").strip()
        except serial.SerialException:
            break

        if not raw_line:
            continue

        parsed = parse_sensor_line(raw_line, feature_set=feature_set)
        output_queue.put((raw_line, parsed))


def main() -> int:
    args = build_arg_parser().parse_args()
    feature_columns = get_feature_columns(args.feature_set)
    finger_names = FINGER_LABELS[args.feature_set]

    percent_columns = [column for column in feature_columns if column.endswith("Percent")]
    smooth_columns = [column for column in feature_columns if column.endswith("Smooth")]

    percent_samples: dict[str, list[int]] = defaultdict(list)
    smooth_samples: dict[str, list[int]] = defaultdict(list)
    invalid_percent_counts: dict[str, int] = defaultdict(int)

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Sampling for {args.seconds:.1f} seconds using feature set {args.feature_set}")
    print("Keep the glove at REST / open hand during this check.")
    print("Waiting 2.0 seconds for Arduino serial to settle...")

    valid_rows = 0
    invalid_rows = 0
    last_progress_second = -1

    with serial.Serial(args.port, args.baud, timeout=0.2) as connection:
        time.sleep(2.0)
        connection.reset_input_buffer()

        lines_queue: queue.Queue[tuple[str, dict[str, int] | None]] = queue.Queue()
        stop_event = threading.Event()
        reader = threading.Thread(
            target=serial_reader_thread,
            args=(connection, args.feature_set, lines_queue, stop_event),
            daemon=True,
        )
        reader.start()

        deadline = time.monotonic() + args.seconds

        while time.monotonic() < deadline:
            elapsed = args.seconds - max(0.0, deadline - time.monotonic())
            elapsed_second = int(elapsed)
            if elapsed_second != last_progress_second:
                last_progress_second = elapsed_second
                print(
                    f"Sampling... {min(elapsed_second, int(args.seconds))}/{int(args.seconds)}s "
                    f"valid_rows={valid_rows} invalid_rows={invalid_rows}"
                )

            try:
                _, parsed = lines_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            if parsed is None:
                invalid_rows += 1
                continue

            valid_rows += 1

            for column in smooth_columns:
                smooth_samples[column].append(parsed[column])

            for column in percent_columns:
                value = parsed[column]
                if value == -1:
                    invalid_percent_counts[column] += 1
                else:
                    percent_samples[column].append(value)

        stop_event.set()

    print(f"Finished sampling. valid_rows={valid_rows} invalid_rows={invalid_rows}")

    if not any(percent_samples.values()) and not any(smooth_samples.values()):
        print("No valid serial samples were captured.", file=sys.stderr)
        return 1

    print()
    for index, finger_name in enumerate(finger_names):
        smooth_column = smooth_columns[index]
        percent_column = percent_columns[index]

        if not smooth_samples[smooth_column]:
            print(f"{finger_name:<6} no samples captured")
            continue

        smooth_mean, smooth_std, smooth_min, smooth_max = summarize(smooth_samples[smooth_column])
        smooth_range = smooth_max - smooth_min
        range_status = assess_range(smooth_range)

        if percent_samples[percent_column]:
            percent_mean, percent_std, percent_min, percent_max = summarize(percent_samples[percent_column])
        else:
            percent_mean, percent_std, percent_min, percent_max = math.nan, math.nan, -1, -1

        percent_status = assess_percent_quality(
            percent_min,
            percent_max,
            percent_std if not math.isnan(percent_std) else 999.0,
            invalid_percent_counts[percent_column],
        )

        print(
            f"{finger_name:<6} "
            f"smooth_mean={smooth_mean:>7.1f} smooth_std={smooth_std:>5.1f} "
            f"smooth_min={smooth_min:>4} smooth_max={smooth_max:>4} "
            f"range={smooth_range:>4} {range_status}"
        )
        print(
            f"{'':6} "
            f"percent_mean={percent_mean:>6.1f} percent_std={percent_std:>5.1f} "
            f"percent_min={percent_min:>4} percent_max={percent_max:>4} "
            f"invalid={invalid_percent_counts[percent_column]:>3} {percent_status}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
