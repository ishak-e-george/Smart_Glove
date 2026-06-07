from __future__ import annotations

import argparse
import time
from collections import Counter, deque
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
import serial

try:
    import pyttsx3
except Exception:
    pyttsx3 = None

FEATURE_COLUMNS = ["indexPercent", "middlePercent", "ringPercent"]

DEFAULT_PHRASES = {
    "REST": "Ready",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "RING_BENT": "Help",
    "INDEX_MIDDLE_BENT": "I need water",
    "INDEX_RING_BENT": "Pain",
    "MIDDLE_RING_BENT": "Thank you",
    "ALL_THREE_BENT": "I need assistance",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="One-shot live demo for the 3-main-finger model.")
    parser.add_argument("--port", default="COM4")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--model", default="models/gesture_model_3main.joblib")
    parser.add_argument("--window", type=int, default=11)
    parser.add_argument("--majority", type=float, default=0.75)
    parser.add_argument("--confidence", type=float, default=0.55)
    parser.add_argument("--rest-hold", type=float, default=0.6)
    parser.add_argument("--gesture-hold", type=float, default=0.9)
    parser.add_argument("--cooldown", type=float, default=1.0)
    parser.add_argument("--no-speech", action="store_true")
    parser.add_argument("--debug", action="store_true")
    return parser.parse_args()


def load_artifact(path: str):
    artifact = joblib.load(path)
    if isinstance(artifact, dict):
        model = artifact["model"]
        features = artifact.get("feature_columns", FEATURE_COLUMNS)
        phrases = artifact.get("phrase_mapping", DEFAULT_PHRASES)
        return model, list(features), phrases
    return artifact, FEATURE_COLUMNS, DEFAULT_PHRASES


def parse_stream_row(line: str) -> Optional[list[float]]:
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    parts = [part.strip() for part in line.split(",")]
    try:
        values = [float(part) for part in parts]
    except ValueError:
        return None

    if len(values) == 5:
        return values[:3]

    if len(values) == 15:
        return [values[2], values[5], values[8]]

    return None


def predict(model, features: list[str], values: list[float]) -> tuple[str, float]:
    row = pd.DataFrame([values], columns=features)
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(row)[0]
        best_index = int(probabilities.argmax())
        return str(model.classes_[best_index]), float(probabilities[best_index])
    return str(model.predict(row)[0]), 1.0


def stable_label(history: deque[tuple[str, float]], majority_threshold: float, confidence_threshold: float):
    if not history:
        return None, 0.0, 0.0

    labels = [label for label, _confidence in history]
    label, count = Counter(labels).most_common(1)[0]
    majority = count / len(history)
    confidences = [confidence for item_label, confidence in history if item_label == label]
    avg_confidence = sum(confidences) / max(1, len(confidences))

    if majority >= majority_threshold and avg_confidence >= confidence_threshold:
        return label, majority, avg_confidence

    return None, majority, avg_confidence


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


def speak(engine, text: str) -> None:
    if engine is None:
        return
    try:
        engine.say(text)
        engine.runAndWait()
    except Exception as exc:
        print(f"[speech warning] {exc}")


def main() -> int:
    args = parse_args()
    if not Path(args.model).exists():
        print(f"Model not found: {args.model}")
        return 1

    model, features, phrases = load_artifact(args.model)
    engine = init_speech(not args.no_speech)

    print("Smart Glove 3-main one-shot demo")
    print(f"Model: {args.model}")
    print(f"Port: {args.port} @ {args.baud}")
    print(f"Window={args.window}, majority={args.majority}, confidence={args.confidence}")
    print("Flow: hold REST until ARMED, make one gesture, return to REST.")

    history: deque[tuple[str, float]] = deque(maxlen=args.window)
    armed = False
    candidate = None
    candidate_since = None
    last_spoken_at = 0.0

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as connection:
            time.sleep(2.0)
            connection.reset_input_buffer()
            try:
                connection.write(b"snap\n")
                time.sleep(0.3)
            except Exception:
                pass

            while True:
                line = connection.readline().decode("utf-8", errors="ignore")
                values = parse_stream_row(line)
                if values is None:
                    continue

                label, confidence = predict(model, features, values)
                history.append((label, confidence))
                chosen, majority, avg_confidence = stable_label(
                    history,
                    args.majority,
                    args.confidence,
                )

                percent_values = [int(value) for value in values]
                if args.debug:
                    print(
                        f"raw={label:<18} stable={str(chosen):<18} "
                        f"maj={majority:.2f} conf={avg_confidence:.2f} "
                        f"armed={armed} percents={percent_values}"
                    )

                now = time.time()
                if chosen != candidate:
                    candidate = chosen
                    candidate_since = now if chosen is not None else None
                    continue

                if chosen is None or candidate_since is None:
                    continue

                stable_for = now - candidate_since

                if not armed:
                    if chosen == "REST" and stable_for >= args.rest_hold:
                        armed = True
                        history.clear()
                        candidate = None
                        candidate_since = None
                        print("ARMED: rest detected. Make a gesture.")
                    continue

                if chosen == "REST":
                    continue

                if stable_for >= args.gesture_hold and now - last_spoken_at >= args.cooldown:
                    phrase = phrases.get(chosen, chosen)
                    print(f"SPEAK: {chosen} -> {phrase}")
                    speak(engine, phrase)
                    last_spoken_at = now
                    armed = False
                    history.clear()
                    candidate = None
                    candidate_since = None
                    print("DISARMED: return to REST for next phrase.")

    except KeyboardInterrupt:
        print("\nStopped 3-main live demo.")
        return 0
    except serial.SerialException as exc:
        print(f"Serial error: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
