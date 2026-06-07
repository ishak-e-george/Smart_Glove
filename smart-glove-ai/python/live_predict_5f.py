from __future__ import annotations

import argparse
from collections import Counter, deque
import sys
import time
from pathlib import Path

import joblib
import pandas as pd
import serial

from common import DEFAULT_BAUD_RATE, get_feature_columns, parse_sensor_line
from gesture_phrases import phrase_for_gesture
from speak import speak_text

FEATURE_SET = "5"
FEATURE_COLUMNS = get_feature_columns(FEATURE_SET)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run stable 5-finger Smart Glove live prediction with phrase speech."
    )
    parser.add_argument("--port", default="COM4", help="Serial port, for example COM4")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD_RATE, help="Serial baud rate")
    parser.add_argument(
        "--model",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "models" / "gesture_model_5f.joblib",
        help="Trained 5-finger model path",
    )
    parser.add_argument(
        "--hold-seconds",
        type=float,
        default=1.2,
        help="Prediction must remain unchanged for this long before output",
    )
    parser.add_argument(
        "--cooldown-seconds",
        type=float,
        default=1.5,
        help="Minimum gap before speaking the same stable gesture again",
    )
    parser.add_argument(
        "--window-size",
        type=int,
        default=9,
        help="Rolling prediction window used for majority vote smoothing",
    )
    parser.add_argument(
        "--majority-ratio",
        type=float,
        default=0.67,
        help="Fraction of the rolling window required for a smoothed prediction",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.55,
        help="Minimum Random Forest probability accepted for a raw prediction",
    )
    parser.add_argument(
        "--show-raw",
        action="store_true",
        help="Print every smoothed prediction change while debugging",
    )
    parser.add_argument(
        "--allowed-labels",
        default="",
        help="Comma-separated labels allowed for live output, for example OPEN,INDEX_BENT,MIDDLE_BENT,RING_BENT,THUMB_BENT,FIST",
    )
    parser.add_argument(
        "--no-speak",
        action="store_true",
        help="Print phrases without pyttsx3 speech",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()

    if not args.model.exists():
        print(f"Model not found: {args.model}", file=sys.stderr)
        return 1

    artifact = joblib.load(args.model)
    model = artifact["model"]
    feature_columns = artifact.get("feature_columns", FEATURE_COLUMNS)
    feature_set = artifact.get("feature_set", FEATURE_SET)
    allowed_labels = {
        label.strip().upper()
        for label in args.allowed_labels.split(",")
        if label.strip()
    }

    if feature_set != FEATURE_SET or len(feature_columns) != len(FEATURE_COLUMNS):
        print(f"Model is not a 5-finger model: feature_set={feature_set}", file=sys.stderr)
        return 1

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Using model: {args.model}")
    print(f"Stable hold: {args.hold_seconds:.2f}s")
    print(
        f"Smoothing: window={args.window_size}, majority={args.majority_ratio:.2f}, "
        f"min confidence={args.min_confidence:.2f}"
    )
    if allowed_labels:
        print(f"Allowed labels: {', '.join(sorted(allowed_labels))}")
    print("Reading 15-value Arduino rows. Press Ctrl+C to stop.")

    prediction_window: deque[str] = deque(maxlen=args.window_size)
    last_smoothed_prediction: str | None = None
    smoothed_started_at: float | None = None
    emitted_prediction_for_segment: str | None = None

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as connection:
            connection.reset_input_buffer()

            while True:
                raw_line = connection.readline().decode("utf-8", errors="ignore")
                parsed = parse_sensor_line(raw_line, feature_set=FEATURE_SET)
                if parsed is None:
                    continue

                feature_row = pd.DataFrame(
                    [[parsed[column] for column in feature_columns]],
                    columns=feature_columns,
                )
                if hasattr(model, "predict_proba"):
                    probabilities = model.predict_proba(feature_row)[0]
                    best_index = int(probabilities.argmax())
                    confidence = float(probabilities[best_index])
                    prediction = str(model.classes_[best_index])
                else:
                    prediction = str(model.predict(feature_row)[0])
                    confidence = 1.0

                if confidence < args.min_confidence:
                    continue

                if allowed_labels and prediction not in allowed_labels:
                    continue

                prediction_window.append(prediction)
                if len(prediction_window) < prediction_window.maxlen:
                    continue

                counts = Counter(prediction_window)
                smoothed_prediction, smoothed_count = counts.most_common(1)[0]
                smoothed_ratio = smoothed_count / len(prediction_window)
                if smoothed_ratio < args.majority_ratio:
                    continue

                now = time.monotonic()

                if smoothed_prediction != last_smoothed_prediction:
                    last_smoothed_prediction = smoothed_prediction
                    smoothed_started_at = now
                    emitted_prediction_for_segment = None
                    if args.show_raw:
                        print(
                            f"Smoothed prediction: {smoothed_prediction} "
                            f"vote={smoothed_count}/{len(prediction_window)} "
                            f"confidence={confidence:.2f}"
                        )
                    continue

                if smoothed_started_at is None:
                    continue

                stable_for = now - smoothed_started_at
                if stable_for < args.hold_seconds:
                    continue

                if smoothed_prediction == emitted_prediction_for_segment:
                    continue

                phrase = phrase_for_gesture(smoothed_prediction)
                print(f"Stable {stable_for:.1f}s: {smoothed_prediction} -> {phrase}")
                emitted_prediction_for_segment = smoothed_prediction

                if not args.no_speak and phrase:
                    try:
                        speak_text(phrase)
                    except RuntimeError as exc:
                        print(str(exc), file=sys.stderr)
                        print("Continuing without speech.", file=sys.stderr)
                        args.no_speak = True
    except KeyboardInterrupt:
        print()
        print("Stopped live prediction.")
        return 0
    except serial.SerialException as exc:
        print(f"Could not open/read serial port {args.port}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
