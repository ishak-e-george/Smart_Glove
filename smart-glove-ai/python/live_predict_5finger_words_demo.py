#!/usr/bin/env python3
"""
Demo-mode live 5-finger word prediction and speech.

This version is stricter than the normal live predictor:
1. It waits for REST before accepting a new word.
2. It speaks only once per gesture.
3. It uses feature names to remove sklearn warnings.
4. It supports confidence gating when the model has predict_proba().

Usage:
python python/live_predict_5finger_words_DEMO.py --port COM4
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


def is_rest(values_by_feature: dict[str, int]) -> bool:
    index = values_by_feature.get("index", 0)
    middle = values_by_feature.get("middle", 0)
    ring = values_by_feature.get("ring", 0)

    # Ring can drift high at rest because of the glove/sensor shape.
    # NAME still requires ring >= 85, so allowing REST up to 60 is safe.
    if index <= 35 and middle <= 35 and ring <= 60:
        return True

    # After FEEL, middle can remain high while index/ring are relaxed.
    # Real FEEL still requires ring >= 55, so this does not mask FEEL.
    if index <= 35 and ring <= 35 and middle <= 85:
        return True

    # Low/medium decay after a gesture is rest drift for this glove.
    # Real FEEL should still be held above this with middle/ring high.
    if index <= 35 and middle < 55 and ring <= 60:
        return True

    return False


def passes_class_gate(label: str, values_by_feature: dict[str, int]) -> bool:
    index = values_by_feature.get("index", 0)
    middle = values_by_feature.get("middle", 0)
    ring = values_by_feature.get("ring", 0)

    if label == "REST":
        return is_rest(values_by_feature)

    if label == "FEEL":
        return index <= 35 and middle >= 55 and 55 <= ring <= 95

    if label == "NAME":
        return index <= 60 and middle <= 35 and ring >= 85

    if label == "WHERE":
        return middle >= 85 and ring >= 95

    if label == "YES":
        return index >= 80 and middle >= 75 and ring >= 85

    return False


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
    parser.add_argument("--window", type=int, default=9)
    parser.add_argument("--min-votes", type=int, default=7)
    parser.add_argument("--confidence", type=float, default=0.60)
    parser.add_argument("--rest-max", type=int, default=25)
    parser.add_argument("--rest-frames", type=int, default=6)
    parser.add_argument("--cooldown", type=float, default=1.5)
    parser.add_argument("--no-tts", action="store_true")
    parser.add_argument("--debug", action="store_true")
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

    if any(feature not in DEFAULT_FEATURES for feature in features):
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
    print("DEMO MODE")
    print("Open hand to REST first. Then make one gesture and hold it.")
    print("After it speaks, return to REST before the next gesture.")
    print("Press Ctrl+C to stop.")
    print()

    history: deque[str] = deque(maxlen=args.window)
    conf_history: deque[float] = deque(maxlen=args.window)

    armed = False
    rest_frames = 0
    last_time = 0.0
    announced_ready = False

    with serial.Serial(args.port, args.baud, timeout=1) as ser:
        time.sleep(2.0)
        ser.reset_input_buffer()
        # Opening Serial resets the Arduino. Force CSV mode for this sketch.
        ser.write(b"m\n")
        ser.flush()

        while True:
            raw = ser.readline().decode(errors="ignore")
            if "Mode: STATUS" in raw or "STATUS" in raw:
                ser.write(b"m\n")
                ser.flush()
                time.sleep(0.1)
                continue
            vals = parse_percent_line(raw)
            if vals is None:
                continue

            live_by_feature = dict(zip(DEFAULT_FEATURES, vals))
            selected_vals = [live_by_feature[feature] for feature in features]
            X_live = pd.DataFrame([selected_vals], columns=features)
            pred = str(model.predict(X_live)[0])

            confidence = 1.0
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X_live)[0]
                confidence = float(max(probs))

            # Hardware-level REST check.
            # This prevents the system from firing continuously while the hand is moving.
            is_rest_by_values = is_rest(live_by_feature)
            rest_detected = pred == "REST" or is_rest_by_values

            if rest_detected:
                rest_frames += 1
                history.clear()
                conf_history.clear()
                if rest_frames < args.rest_frames:
                    if args.debug:
                        print(
                            f"REST frame {rest_frames}/{args.rest_frames}: "
                            f"{selected_vals} -> {pred}"
                        )
                    continue
                armed = True
                if not announced_ready:
                    print("REST detected. Ready for next gesture.")
                    announced_ready = True
                continue

            rest_frames = 0

            if not armed:
                if args.debug:
                    print(f"Waiting for REST... {vals} -> {pred} conf={confidence:.2f}")
                continue

            announced_ready = False
            history.append(pred)
            conf_history.append(confidence)

            counts = Counter(history)
            label, votes = counts.most_common(1)[0]
            avg_conf = sum(conf_history) / len(conf_history)

            if args.debug:
                gate_ok = passes_class_gate(label, live_by_feature)
                print(
                    f"{vals} -> {pred} conf={confidence:.2f} | "
                    f"majority={label} votes={votes} avg_conf={avg_conf:.2f} "
                    f"gate={gate_ok}"
                )

            now = time.time()
            gate_ok = passes_class_gate(label, live_by_feature)
            if (
                label != "REST"
                and votes >= args.min_votes
                and avg_conf >= args.confidence
                and gate_ok
                and (now - last_time) >= args.cooldown
            ):
                phrase = phrases.get(label, label.replace("_", " ").title())
                print(f"{vals} -> {label}: {phrase}  confidence={avg_conf:.2f}")

                if engine is not None and phrase:
                    engine.say(phrase)
                    engine.runAndWait()

                last_time = now
                armed = False
                history.clear()
                conf_history.clear()
                print("Return to REST before the next gesture.")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nStopped.")
