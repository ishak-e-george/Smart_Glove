import argparse
import csv
import os
import sys
import time

import serial


FINGERS = ["index", "middle", "ring", "pinky", "thumb"]


def parse_finger_list(value):
    names = [name.strip().lower() for name in value.split(",") if name.strip()]
    unknown = [name for name in names if name not in FINGERS]

    if unknown:
        raise argparse.ArgumentTypeError(
            "Unknown finger name(s): "
            + ", ".join(unknown)
            + ". Valid names: "
            + ", ".join(FINGERS)
        )

    return names


def is_accepted_sample(label, values, rest_max, rest_gate_fingers):
    label = label.upper()

    if label != "REST":
        if label == "YES":
            index, middle, ring = values[:3]

            if index < 60 or middle < 70 or ring < 60:
                return (
                    False,
                    "YES needs index>=60, middle>=70, ring>=60: "
                    f"{values}",
                )

            return True, "ok"

        single_finger_targets = {
            "INDEX_ONLY": 0,
            "MIDDLE_ONLY": 1,
            "RING_ONLY": 2,
            "PINKY_ONLY": 3,
            "THUMB_ONLY": 4,
        }
        target_index = single_finger_targets.get(label)

        if target_index is None:
            return True, "ok"

        target_value = values[target_index]
        other_values = [v for i, v in enumerate(values) if i != target_index]

        if target_value < 55:
            return False, f"{label} target below 55: {values}"

        if any(v > 35 for v in other_values):
            return False, f"{label} non-target above 35: {values}"

        return True, "ok"

    gated_values = [
        values[FINGERS.index(finger)]
        for finger in rest_gate_fingers
    ]

    if any(v > rest_max for v in gated_values):
        return (
            False,
            f"REST gated finger above {rest_max}: "
            f"{dict(zip(rest_gate_fingers, gated_values))} full={values}",
        )

    return True, "ok"


def parse_csv_line(line):
    line = line.strip()

    if not line:
        return None

    if line.startswith("#"):
        return None

    parts = line.split(",")

    if len(parts) != 5:
        return None

    try:
        values = [int(x.strip()) for x in parts]
    except ValueError:
        return None

    if any(v < 0 or v > 100 for v in values):
        return None

    return values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True, help="Arduino COM port, example COM5")
    parser.add_argument("--label", required=True, help="Gesture label, example REST")
    parser.add_argument("--samples", type=int, default=200)
    parser.add_argument("--out", default="data/smart_glove_5f_dataset.csv")
    parser.add_argument(
        "--mode-command",
        default="m",
        help="Command sent after connecting to enable CSV mode. Use '' to disable.",
    )
    parser.add_argument(
        "--max-silence",
        type=float,
        default=20.0,
        help="Stop if no valid CSV is received for this many seconds.",
    )
    parser.add_argument(
        "--rest-max",
        type=int,
        default=20,
        help="For REST only, reject samples with any finger above this value.",
    )
    parser.add_argument(
        "--rest-gate-fingers",
        type=parse_finger_list,
        default=FINGERS,
        help=(
            "Comma-separated fingers checked by the REST gate. "
            "Example: index,middle,ring"
        ),
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="Reopen the serial port this many times if the Arduino stream goes silent.",
    )
    parser.add_argument(
        "--no-gate",
        action="store_true",
        help="Save valid CSV rows without label-specific quality filtering.",
    )
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)

    file_exists = os.path.exists(args.out)

    print()
    print("====================================")
    print(" Smart Glove 5-Finger Data Collector")
    print("====================================")
    print(f"Port:    {args.port}")
    print(f"Label:   {args.label}")
    print(f"Samples: {args.samples}")
    print(f"Output:  {args.out}")
    print()
    print("Prepare the gesture now.")
    print("Starting in 3 seconds...")
    time.sleep(3)

    def open_serial():
        ser = serial.Serial(args.port, 115200, timeout=2)
        print("Connected. Waiting for Arduino reset...")
        time.sleep(2)

        if args.mode_command:
            print(f"Sending CSV mode command: {args.mode_command}")
            ser.write((args.mode_command + "\n").encode())
            ser.flush()
            time.sleep(0.5)

        return ser

    ser = open_serial()

    collected = 0
    ignored = 0
    reconnects = 0
    last_progress = time.time()
    last_valid_csv = time.time()

    with open(args.out, "a", newline="") as f:
        writer = csv.writer(f)

        if not file_exists:
            writer.writerow(["timestamp", "label"] + FINGERS)

        while collected < args.samples:
            raw = ser.readline().decode(errors="ignore").strip()
            values = parse_csv_line(raw)

            if values is None:
                ignored += 1
                if time.time() - last_progress >= 5:
                    print(
                        "Waiting for valid CSV. "
                        f"Ignored {ignored} lines. Last received: {raw!r}"
                    )
                    sys.stdout.flush()
                    last_progress = time.time()
                if time.time() - last_valid_csv >= args.max_silence:
                    if reconnects < args.retries:
                        reconnects += 1
                        print()
                        print(
                            "No valid CSV for "
                            f"{args.max_silence:.0f} seconds. "
                            f"Reopening serial port ({reconnects}/{args.retries})..."
                        )
                        ser.close()
                        time.sleep(1)
                        ser = open_serial()
                        last_progress = time.time()
                        last_valid_csv = time.time()
                        continue
                    else:
                        print()
                        print(
                            "Stopped: no valid CSV received for "
                            f"{args.max_silence:.0f} seconds after "
                            f"{args.retries} reconnect attempts."
                        )
                        print("Close this run, unplug/replug Arduino if needed, then retry.")
                        ser.close()
                        return
                continue

            if not args.no_gate:
                accepted, reason = is_accepted_sample(
                    args.label,
                    values,
                    args.rest_max,
                    args.rest_gate_fingers,
                )
                if not accepted:
                    ignored += 1
                    if ignored == 1 or ignored % 10 == 0:
                        print(f"Rejected {ignored}: {reason}")
                    last_progress = time.time()
                    continue

            writer.writerow([time.time(), args.label] + values)
            collected += 1
            last_progress = time.time()
            last_valid_csv = time.time()

            print(f"{collected:03d}/{args.samples}  {args.label}: {values}")

    ser.close()

    print()
    print(f"Done. Saved {collected} samples for label: {args.label}")


if __name__ == "__main__":
    main()
