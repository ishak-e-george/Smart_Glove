from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import joblib
import pandas as pd
import serial

from common import DEFAULT_BAUD_RATE, DEFAULT_GESTURE_TO_WORD, FEATURE_COLUMNS, parse_sensor_line
from speak import speak_text


DEFAULT_SENTENCE_RULES = {
    ("WATER",): "I want water.",
    ("WATER", "PLEASE"): "I want water, please.",
    ("HELP",): "I need help.",
    ("YES",): "Yes.",
    ("NO",): "No.",
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run live gesture prediction from Arduino serial data."
    )

    parser.add_argument(
        "--port",
        required=True,
        help="Serial port, for example COM4 or COM5",
    )

    parser.add_argument(
        "--baud",
        type=int,
        default=DEFAULT_BAUD_RATE,
        help="Serial baud rate",
    )

    parser.add_argument(
        "--model",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "models" / "gesture_model.joblib",
        help="Trained model path",
    )

    parser.add_argument(
        "--hold-seconds",
        type=float,
        default=0.8,
        help="Required stable time before accepting a gesture",
    )

    parser.add_argument(
        "--speak",
        action="store_true",
        help="Speak accepted output with pyttsx3",
    )

    parser.add_argument(
        "--build-sentence",
        action="store_true",
        help="Convert accepted words into simple rule-based sentences",
    )

    parser.add_argument(
        "--sentence-gap-seconds",
        type=float,
        default=2.0,
        help="Silence gap that flushes the current word buffer",
    )

    return parser


def flush_words(words: list[str], build_sentence: bool) -> str:
    if not words:
        return ""

    normalized = tuple(word.upper() for word in words)

    if build_sentence:
        sentence = DEFAULT_SENTENCE_RULES.get(normalized)
        if sentence:
            return sentence

    return " ".join(words)


def main() -> int:
    args = build_arg_parser().parse_args()

    if not args.model.exists():
        print(f"Model not found: {args.model}", file=sys.stderr)
        return 1

    artifact = joblib.load(args.model)
    model = artifact["model"]
    feature_columns = artifact.get("feature_columns", FEATURE_COLUMNS)

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Using model: {args.model}")
    print(f"Hold threshold: {args.hold_seconds:.2f}s")

    last_prediction: str | None = None
    prediction_started_at: float | None = None
    accepted_prediction: str | None = None

    accepted_words: list[str] = []
    last_word_time: float | None = None

    with serial.Serial(args.port, args.baud, timeout=1) as connection:
        connection.reset_input_buffer()

        while True:
            raw_line = connection.readline().decode("utf-8", errors="ignore")
            parsed = parse_sensor_line(raw_line, feature_set=artifact.get("feature_set"))

            if parsed is None:
                continue

            feature_values = [[parsed[column] for column in feature_columns]]

            feature_row = pd.DataFrame(
                feature_values,
                columns=feature_columns,
            )

            prediction = str(model.predict(feature_row)[0])
            now = time.monotonic()

            if prediction != last_prediction:
                last_prediction = prediction
                prediction_started_at = now
                continue

            if prediction_started_at is None:
                continue

            stable_for = now - prediction_started_at

            if stable_for < args.hold_seconds:
                continue

            if prediction == accepted_prediction:
                continue

            accepted_prediction = prediction
            word = DEFAULT_GESTURE_TO_WORD.get(prediction, prediction)

            print(f"Accepted gesture: {prediction} -> {word or '(no output)'}")

            if not word:
                continue

            accepted_words.append(word)
            last_word_time = now

            if not args.build_sentence:
                if args.speak:
                    speak_text(word)
                else:
                    print(f"Word output: {word}")

            if (
                args.build_sentence
                and accepted_words
                and last_word_time is not None
                and now - last_word_time >= args.sentence_gap_seconds
            ):
                sentence = flush_words(accepted_words, build_sentence=True)

                if sentence:
                    print(f"Sentence output: {sentence}")
                    if args.speak:
                        speak_text(sentence)

                accepted_words.clear()
                last_word_time = None


if __name__ == "__main__":
    sys.exit(main())
