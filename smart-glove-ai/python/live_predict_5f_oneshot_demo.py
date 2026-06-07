#!/usr/bin/env python3
"""
One-shot demo live prediction for Smart Glove 5-finger AI.

This version is designed for presentation/demo:
1. Wait until OPEN is stable.
2. Arm the system.
3. Speak one non-OPEN gesture.
4. Disarm.
5. Require OPEN again before another phrase can be spoken.

This prevents repeated "No No No" or "Help Help Help" while one gesture is held.

Run:
    python python/live_predict_5f_oneshot_demo.py --port COM4 --demo-main

Debug:
    python python/live_predict_5f_oneshot_demo.py --port COM4 --demo-main --debug
"""

from __future__ import annotations

import argparse
import time
from collections import Counter, deque
from typing import Dict, List, Optional, Sequence, Tuple

import joblib
import pandas as pd
import serial

try:
    import pyttsx3
except Exception:
    pyttsx3 = None


PHRASES = {
    "OPEN": "Ready",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "RING_BENT": "Help",
    "PINKY_BENT": "Thank you",
    "THUMB_BENT": "I am okay",
    "FIST": "I need assistance",
}

DEFAULT_FEATURES = [
    "indexRaw", "indexSmooth", "indexPercent",
    "middleRaw", "middleSmooth", "middlePercent",
    "ringRaw", "ringSmooth", "ringPercent",
    "pinkyRaw", "pinkySmooth", "pinkyPercent",
    "thumbRaw", "thumbSmooth", "thumbPercent",
]

MAIN_DEMO_LABELS = {
    "INDEX_BENT",
    "MIDDLE_BENT",
    "RING_BENT",
    "THUMB_BENT",
    "FIST",
}

ALL_DEMO_LABELS = {
    "INDEX_BENT",
    "MIDDLE_BENT",
    "RING_BENT",
    "PINKY_BENT",
    "THUMB_BENT",
    "FIST",
}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--port", default="COM4")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument("--model", default="models/gesture_model_5f.joblib")
    p.add_argument("--window", type=int, default=15)
    p.add_argument("--majority", type=float, default=0.80)
    p.add_argument("--confidence", type=float, default=0.62)
    p.add_argument("--gesture-hold", type=float, default=1.20)
    p.add_argument("--open-hold", type=float, default=0.70)
    p.add_argument("--cooldown", type=float, default=1.00)
    p.add_argument("--demo-main", action="store_true", help="Ignore PINKY_BENT for main demo")
    p.add_argument("--no-speech", action="store_true")
    p.add_argument("--debug", action="store_true")
    return p.parse_args()


def load_model(path: str):
    artifact = joblib.load(path)
    if isinstance(artifact, dict):
        model = artifact.get("model") or artifact.get("classifier") or artifact.get("clf")
        if model is None:
            raise ValueError("Could not find model/classifier/clf inside joblib artifact.")
        features = (
            artifact.get("feature_columns")
            or artifact.get("feature_names")
            or artifact.get("features")
            or DEFAULT_FEATURES
        )
        return model, list(features)
    return artifact, DEFAULT_FEATURES


def parse_row(line: str) -> Optional[List[float]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    parts = [p.strip() for p in line.split(",")]
    if len(parts) != 15:
        return None
    try:
        return [float(p) for p in parts]
    except ValueError:
        return None


def predict(model, values: Sequence[float], features: Sequence[str]) -> Tuple[str, float]:
    x = pd.DataFrame([list(values)], columns=list(features))
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(x)[0]
        classes = list(model.classes_)
        best_i = max(range(len(probs)), key=lambda i: probs[i])
        return str(classes[best_i]), float(probs[best_i])
    return str(model.predict(x)[0]), 1.0


def stable_label(history: deque, majority_threshold: float, confidence_threshold: float) -> Tuple[Optional[str], float, float]:
    if not history:
        return None, 0.0, 0.0
    labels = [x[0] for x in history]
    label, count = Counter(labels).most_common(1)[0]
    majority = count / len(history)
    probs = [p for y, p in history if y == label]
    avg_conf = sum(probs) / max(1, len(probs))
    if majority >= majority_threshold and avg_conf >= confidence_threshold:
        return label, majority, avg_conf
    return None, majority, avg_conf


def init_speech(enabled: bool):
    if not enabled or pyttsx3 is None:
        return None
    try:
        engine = pyttsx3.init()
        engine.setProperty("rate", 165)
        return engine
    except Exception as exc:
        print(f"[speech warning] {exc}")
        return None


def speak(engine, text: str):
    if engine is None:
        return
    try:
        engine.say(text)
        engine.runAndWait()
    except Exception as exc:
        print(f"[speech warning] {exc}")


def main() -> int:
    args = parse_args()
    model, features = load_model(args.model)
    engine = init_speech(not args.no_speech)

    allowed_gestures = MAIN_DEMO_LABELS if args.demo_main else ALL_DEMO_LABELS

    print("Smart Glove one-shot demo prediction")
    print(f"Model: {args.model}")
    print(f"Port: {args.port} @ {args.baud}")
    print(f"Window={args.window}, majority={args.majority}, confidence={args.confidence}")
    print(f"Open hold={args.open_hold}s, gesture hold={args.gesture_hold}s")
    if args.demo_main:
        print("Demo-main mode: PINKY_BENT is ignored.")
    print("")
    print("Demo flow:")
    print("1. Open hand until ARMED appears.")
    print("2. Make one gesture and hold it.")
    print("3. After speech, return to OPEN to arm the next phrase.")
    print("Press Ctrl+C to stop.")
    print("")

    history = deque(maxlen=args.window)
    armed = False
    stable_candidate = None
    stable_since = None
    last_spoken_at = 0.0

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as ser:
            time.sleep(2.0)
            ser.reset_input_buffer()
            try:
                ser.write(b"snap\n")
                time.sleep(0.3)
            except Exception:
                pass

            while True:
                line = ser.readline().decode("utf-8", errors="ignore")
                values = parse_row(line)
                if values is None:
                    continue

                raw_label, prob = predict(model, values, features)

                # In main demo, don't let pinky noise trigger a phrase.
                label = raw_label
                if args.demo_main and label == "PINKY_BENT":
                    label = "NOISE"

                history.append((label, prob))
                chosen, majority, avg_conf = stable_label(history, args.majority, args.confidence)

                percents = [int(values[i]) for i in [2, 5, 8, 11, 14]]

                if args.debug:
                    print(
                        f"raw={raw_label:<12} used={label:<12} stable={str(chosen):<12} "
                        f"maj={majority:.2f} conf={avg_conf:.2f} armed={armed} percents={percents}"
                    )

                now = time.time()

                if chosen != stable_candidate:
                    stable_candidate = chosen
                    stable_since = now if chosen is not None else None
                    continue

                if chosen is None or stable_since is None:
                    continue

                stable_for = now - stable_since

                # Arm only when OPEN is stable.
                if not armed:
                    if chosen == "OPEN" and stable_for >= args.open_hold:
                        armed = True
                        history.clear()
                        stable_candidate = None
                        stable_since = None
                        print("ARMED: open hand detected. Make a gesture.")
                    continue

                # If armed and still open, wait for gesture.
                if chosen == "OPEN":
                    continue

                # Speak only allowed non-open gestures.
                if chosen in allowed_gestures and stable_for >= args.gesture_hold:
                    if now - last_spoken_at >= args.cooldown:
                        phrase = PHRASES.get(chosen, chosen)
                        print(f"SPEAK: {chosen} -> {phrase}")
                        speak(engine, phrase)
                        last_spoken_at = now

                        # Disarm until user returns to OPEN.
                        armed = False
                        history.clear()
                        stable_candidate = None
                        stable_since = None
                        print("DISARMED: return to OPEN for next phrase.")

    except KeyboardInterrupt:
        print("\nStopped one-shot demo.")
        return 0
    except serial.SerialException as exc:
        print(f"Serial error: {exc}")
        return 2
    except FileNotFoundError:
        print(f"Model not found: {args.model}")
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
