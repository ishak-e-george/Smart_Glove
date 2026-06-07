#!/usr/bin/env python3
"""
Guarded live prediction for Smart Glove 5-finger AI.

Why this version exists:
- The trained model can score well offline but flicker live because fingers move,
  weak sensors jump, and neighboring gestures overlap.
- This script does NOT speak every raw prediction.
- It uses a rolling majority vote + probability confidence + hold timer + cooldown.

Run:
    python python/live_predict_5f_guarded.py --port COM4

Useful demo mode:
    python python/live_predict_5f_guarded.py --port COM4 --demo-main

Debug:
    python python/live_predict_5f_guarded.py --port COM4 --debug
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from collections import Counter, deque
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import joblib
import pandas as pd
import serial

try:
    import pyttsx3
except Exception:
    pyttsx3 = None


DEFAULT_FEATURES = [
    "indexRaw", "indexSmooth", "indexPercent",
    "middleRaw", "middleSmooth", "middlePercent",
    "ringRaw", "ringSmooth", "ringPercent",
    "pinkyRaw", "pinkySmooth", "pinkyPercent",
    "thumbRaw", "thumbSmooth", "thumbPercent",
]

PHRASES = {
    "OPEN": "Hello",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "RING_BENT": "Help",
    "PINKY_BENT": "Thank you",
    "THUMB_BENT": "I am okay",
    "FIST": "I need assistance",
}

# For prototype demo, these are the most reliable labels based on your results.
MAIN_DEMO_LABELS = {
    "OPEN",
    "INDEX_BENT",
    "MIDDLE_BENT",
    "RING_BENT",
    "THUMB_BENT",
    "FIST",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default="COM4", help="Arduino serial port, e.g. COM4")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument(
        "--model",
        default="models/gesture_model_5f.joblib",
        help="Path to trained joblib model/artifact",
    )
    parser.add_argument("--window", type=int, default=11, help="Rolling prediction window")
    parser.add_argument(
        "--majority",
        type=float,
        default=0.73,
        help="Minimum fraction of window that must agree",
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.58,
        help="Minimum average RF probability for the majority label",
    )
    parser.add_argument(
        "--hold",
        type=float,
        default=1.20,
        help="Seconds the guarded label must remain stable before speaking",
    )
    parser.add_argument(
        "--cooldown",
        type=float,
        default=2.50,
        help="Seconds before the same label can be spoken again",
    )
    parser.add_argument(
        "--demo-main",
        action="store_true",
        help="Disable PINKY_BENT during live demo because it is the noisiest class",
    )
    parser.add_argument(
        "--require-open-reset",
        action="store_true",
        help="After speaking a bent gesture, require stable OPEN before speaking another bent gesture.",
    )
    parser.add_argument(
        "--no-speech",
        action="store_true",
        help="Print only; do not speak",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print raw predictions, probabilities, and percent values",
    )
    return parser.parse_args()


def load_model(path: str):
    artifact = joblib.load(path)

    if isinstance(artifact, dict):
        model = artifact.get("model") or artifact.get("classifier") or artifact.get("clf")
        features = (
            artifact.get("feature_columns")
            or artifact.get("feature_names")
            or artifact.get("features")
            or DEFAULT_FEATURES
        )
        if model is None:
            raise ValueError("Joblib artifact is a dict but no model/classifier/clf key was found.")
        return model, list(features)

    return artifact, DEFAULT_FEATURES


def parse_serial_row(line: str) -> Optional[List[float]]:
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


def predict_with_probability(
    model,
    values: Sequence[float],
    features: Sequence[str],
) -> Tuple[str, float, Dict[str, float]]:
    x = pd.DataFrame([list(values)], columns=list(features))

    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(x)[0]
        classes = list(model.classes_)
        best_idx = max(range(len(proba)), key=lambda i: proba[i])
        label = str(classes[best_idx])
        prob = float(proba[best_idx])
        dist = {str(c): float(p) for c, p in zip(classes, proba)}
        return label, prob, dist

    label = str(model.predict(x)[0])
    return label, 1.0, {label: 1.0}


def choose_guarded_label(
    history: deque,
    majority_threshold: float,
    confidence_threshold: float,
    allowed_labels: Optional[set],
) -> Tuple[Optional[str], float, float]:
    if not history:
        return None, 0.0, 0.0

    labels = [item[0] for item in history]

    if allowed_labels is not None:
        labels = [label for label in labels if label in allowed_labels]

    if not labels:
        return None, 0.0, 0.0

    counts = Counter(labels)
    label, count = counts.most_common(1)[0]
    majority = count / len(history)

    matching_probs = [prob for pred_label, prob in history if pred_label == label]
    avg_prob = sum(matching_probs) / max(1, len(matching_probs))

    if majority >= majority_threshold and avg_prob >= confidence_threshold:
        return label, majority, avg_prob

    return None, majority, avg_prob


def speak(engine, phrase: str) -> None:
    if engine is None:
        return
    try:
        engine.say(phrase)
        engine.runAndWait()
    except Exception as exc:
        print(f"[speech warning] {exc}")


def main() -> int:
    args = parse_args()

    model, features = load_model(args.model)
    if len(features) != 15:
        print(f"Warning: expected 15 features but model artifact lists {len(features)} features.")

    engine = None
    if not args.no_speech and pyttsx3 is not None:
        try:
            engine = pyttsx3.init()
            engine.setProperty("rate", 165)
        except Exception as exc:
            print(f"[speech warning] pyttsx3 init failed: {exc}")
            engine = None

    allowed_labels = MAIN_DEMO_LABELS if args.demo_main else None
    require_open_reset = args.require_open_reset or args.demo_main

    print("Guarded Smart Glove live prediction")
    print(f"Model: {args.model}")
    print(f"Port: {args.port} @ {args.baud}")
    print(f"Window={args.window}, majority={args.majority}, confidence={args.confidence}, hold={args.hold}s, cooldown={args.cooldown}s")
    if args.demo_main:
        print("Demo-main mode: PINKY_BENT is ignored for speaking.")
    if require_open_reset:
        print("Open-reset mode: after a bent gesture, stable OPEN is required before the next phrase.")
    print("Reading 15-value Arduino rows. Press Ctrl+C to stop.")

    history = deque(maxlen=args.window)
    candidate_label = None
    candidate_since = None
    last_spoken_label = None
    last_spoken_at = 0.0
    waiting_for_open_reset = False

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as ser:
            time.sleep(2.0)
            ser.reset_input_buffer()

            # If firmware supports snap, use it once at startup.
            try:
                ser.write(b"snap\n")
                time.sleep(0.3)
            except Exception:
                pass

            while True:
                raw = ser.readline().decode("utf-8", errors="ignore")
                values = parse_serial_row(raw)
                if values is None:
                    continue

                label, prob, _dist = predict_with_probability(model, values, features)

                # Optional demo gate: do not let the noisiest pinky class dominate speech.
                if args.demo_main and label == "PINKY_BENT":
                    label_for_history = "NOISY_PINKY"
                    prob_for_history = prob
                else:
                    label_for_history = label
                    prob_for_history = prob

                history.append((label_for_history, prob_for_history))

                guarded, majority, avg_prob = choose_guarded_label(
                    history,
                    args.majority,
                    args.confidence,
                    allowed_labels,
                )

                if args.debug:
                    percents = [int(values[i]) for i in [2, 5, 8, 11, 14]]
                    print(
                        f"raw={label:<12} prob={prob:.2f} "
                        f"guarded={str(guarded):<12} maj={majority:.2f} avgp={avg_prob:.2f} "
                        f"percents={percents}"
                    )

                now = time.time()

                if guarded is None:
                    candidate_label = None
                    candidate_since = None
                    continue

                if waiting_for_open_reset and guarded != "OPEN":
                    continue

                if guarded != candidate_label:
                    candidate_label = guarded
                    candidate_since = now
                    if not args.debug:
                        print(f"Candidate: {guarded} maj={majority:.2f} conf={avg_prob:.2f}")
                    continue

                stable_for = now - (candidate_since or now)
                cooldown_ok = (
                    guarded != last_spoken_label
                    or (now - last_spoken_at) >= args.cooldown
                )

                if stable_for >= args.hold and cooldown_ok:
                    phrase = PHRASES.get(guarded, guarded)
                    if waiting_for_open_reset and guarded == "OPEN":
                        print(f"RESET {stable_for:.1f}s: OPEN")
                        waiting_for_open_reset = False
                    else:
                        print(f"STABLE {stable_for:.1f}s: {guarded} -> {phrase}")
                        speak(engine, phrase)
                        if require_open_reset and guarded != "OPEN":
                            waiting_for_open_reset = True
                    last_spoken_label = guarded
                    last_spoken_at = now

                    # Clear history so one stable gesture does not repeat immediately.
                    history.clear()
                    candidate_label = None
                    candidate_since = None

    except KeyboardInterrupt:
        print("\nStopped guarded live prediction.")
        return 0
    except serial.SerialException as exc:
        print(f"Serial error: {exc}")
        return 2
    except FileNotFoundError:
        print(f"Model not found: {args.model}")
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
