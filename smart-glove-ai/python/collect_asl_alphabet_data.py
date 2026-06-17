#!/usr/bin/env python3
"""
collect_asl_alphabet_data.py

Connects to the smart glove over Serial (COM4, 115200) and captures
exactly N rows of sensor values for a specified letter.
Saves data directly to the ASL Alphabet dataset.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

try:
    import serial
except ImportError:
    print("Missing dependency: pip install pyserial")
    sys.exit(1)

FEATURES = ["index", "middle", "ring", "pinky", "thumb"]
CSV_COLUMNS = ["label"] + FEATURES


def parse_csv_values(line: str) -> list[int] | None:
    if not line or line.startswith("#"):
        return None

    parts = line.split(",")
    if len(parts) < 5:
        return None

    try:
        return [max(0, min(100, int(float(p)))) for p in parts[:5]]
    except ValueError:
        return None


def wait_for_csv_stream(ser: serial.Serial) -> None:
    """Make sure Arduino is producing 5-value CSV without blindly toggling mode off."""
    ser.reset_input_buffer()

    deadline = time.time() + 2.0
    while time.time() < deadline:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if parse_csv_values(line) is not None:
            return

    ser.write(b"m\n")
    ser.flush()
    time.sleep(0.5)
    ser.reset_input_buffer()

    deadline = time.time() + 3.0
    while time.time() < deadline:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if parse_csv_values(line) is not None:
            return

    raise serial.SerialException(
        "Arduino is not sending CSV values. In Serial Monitor send 'm' until it prints '# Mode changed to CSV', then close Serial Monitor."
    )


def ensure_csv(csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if csv_path.exists() and csv_path.stat().st_size > 0:
        return
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect 5-finger Smart Glove sensor rows.")
    parser.add_argument("--port", default="COM4", help="Arduino serial port, e.g. COM4")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--label", required=True, help="Gesture label (e.g. A, B, C, D, K, L, U, REST)")
    parser.add_argument("--rows", type=int, default=500, help="Number of rows to collect")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "data"
        / "external"
        / "asl_alphabet"
        / "asl_alphabet_5finger.csv",
        help="Dataset output path",
    )
    args = parser.parse_args()

    label = args.label.strip().upper()
    csv_path = args.csv

    ensure_csv(csv_path)

    print("=" * 55)
    print(f"  Smart Glove ASL Alphabet Data Collector")
    print(f"  Port        : {args.port} (@ {args.baud} baud)")
    print(f"  Label       : {label}")
    print(f"  Target Rows : {args.rows}")
    print(f"  Saving to   : {csv_path.resolve()}")
    print("=" * 55)
    print()

    input(f"Form the gesture for '{label}' on the glove, hold it steady, and press Enter to start...")

    captured = []
    
    try:
        with serial.Serial(args.port, args.baud, timeout=1.5) as ser:
            time.sleep(2.0)  # Wait for serial reboot
            wait_for_csv_stream(ser)
            
            print("Recording started. Keep your hand still...")
            
            while len(captured) < args.rows:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                vals = parse_csv_values(line)
                if vals is None:
                    continue
                
                row = {
                    "label": label,
                    "index": vals[0],
                    "middle": vals[1],
                    "ring": vals[2],
                    "pinky": vals[3],
                    "thumb": vals[4]
                }
                captured.append(row)
                
                count = len(captured)
                if count == 1 or count % 50 == 0 or count == args.rows:
                    print(f"  [{count:>4}/{args.rows}] percentages: {vals}")
                    
    except serial.SerialException as e:
        print(f"Error opening/reading serial port {args.port}: {e}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nCollection interrupted by user.")
        if not captured:
            return 0
        ans = input(f"Save the {len(captured)} rows collected so far? (y/n): ").strip().lower()
        if ans != 'y':
            print("Data discarded.")
            return 0

    # Append to CSV file
    with csv_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writerows(captured)
        
    print(f"\nSuccessfully saved {len(captured)} rows for '{label}' to {csv_path.name}!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
