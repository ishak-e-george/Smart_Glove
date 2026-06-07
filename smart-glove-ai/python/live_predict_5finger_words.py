#!/usr/bin/env python3
"""
Live 5-finger word prediction and speech.

Usage:
python python/live_predict_5finger_words.py --port COM4
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from collections import deque, Counter

try:
    import joblib
    import pandas as pd
    import serial
except ImportError:
    print("Missing dependencies. Install with: pip install pyserial joblib scikit-learn pandas")
    sys.exit(1)

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None


DEFAULT_FEATURES = ["index", "middle", "ring", "pinky", "thumb"]


def parse_percent_line(line: str) -> list[int] | None:
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 5:
        return None

    try:
        vals = [int(float(p)) for p in parts[:5]]
    except ValueError:
        return None

    return [max(0, min(100, v)) for v in vals]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True)
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--model", default="models/glove_5word_model.joblib")
    parser.add_argument("--window", type=int, default=7)
    parser.add_argument("--min-votes", type=int, default=5)
    parser.add_argument("--cooldown", type=float, default=1.2)
    parser.add_argument("--no-tts", action="store_true")
    args = parser.parse_args()

    artifact_path = Path(args.model)
    if not artifact_path.exists():
        print(f"Model not found: {artifact_path}")
        print("Train first with: python python/train_5finger_word_model.py")
        return 2

    artifact = joblib.load(artifact_path)
    model = artifact["model"]
    phrases = artifact.get("phrases", {})
    features = artifact.get("features", DEFAULT_FEATURES)

    if len(features) != 5:
        print(f"Model feature list is invalid: {features}")
        return 2

    engine = None
    if not args.no_tts and pyttsx3 is not None:
        engine = pyttsx3.init()
        try:
            engine.setProperty("rate", 155)
        except Exception:
            pass

    print(f"Opening {args.port} at {args.baud}")
    print("Press Ctrl+C to stop.")
    print()

    history: deque[str] = deque(maxlen=args.window)
    last_spoken = None
    last_time = 0.0

    with serial.Serial(args.port, args.baud, timeout=1) as ser:
        time.sleep(2.0)
        ser.reset_input_buffer()
        ser.write(b"snap\n")
        ser.flush()

        while True:
            raw = ser.readline().decode(errors="ignore")
            vals = parse_percent_line(raw)
            if vals is None:
                continue

            # Use a DataFrame with the same feature names used during training.
            # This removes the sklearn "X does not have valid feature names" warning.
            X_live = pd.DataFrame([vals], columns=features)
            pred = str(model.predict(X_live)[0])
            history.append(pred)

            counts = Counter(history)
            label, votes = counts.most_common(1)[0]

            if votes >= args.min_votes and label != "REST":
                now = time.time()
                if label != last_spoken or (now - last_time) >= args.cooldown:
                    phrase = phrases.get(label, label.replace("_", " ").title())
                    print(f"{vals} -> {label}: {phrase}")

                    if engine is not None and phrase:
                        engine.say(phrase)
                        engine.runAndWait()

                    last_spoken = label
                    last_time = now

                    # Clear history so the next gesture starts from a clean slate.
                    history.clear()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nStopped.")
