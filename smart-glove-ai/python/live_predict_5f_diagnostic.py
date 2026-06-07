#!/usr/bin/env python3
"""
Quick live diagnostic for the Smart Glove 5-finger model.
Prints percents + probabilities so you can see why live prediction flickers.

Run:
    python python/live_predict_5f_diagnostic.py --port COM4
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import joblib
import pandas as pd
import serial

DEFAULT_FEATURES = [
    "indexRaw", "indexSmooth", "indexPercent",
    "middleRaw", "middleSmooth", "middlePercent",
    "ringRaw", "ringSmooth", "ringPercent",
    "pinkyRaw", "pinkySmooth", "pinkyPercent",
    "thumbRaw", "thumbSmooth", "thumbPercent",
]


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--port", default="COM4")
    p.add_argument("--baud", type=int, default=115200)
    p.add_argument("--model", default="models/gesture_model_5f.joblib")
    return p.parse_args()


def load_model(path):
    artifact = joblib.load(path)
    if isinstance(artifact, dict):
        model = artifact.get("model") or artifact.get("classifier") or artifact.get("clf")
        features = artifact.get("feature_columns") or artifact.get("feature_names") or artifact.get("features") or DEFAULT_FEATURES
        return model, list(features)
    return artifact, DEFAULT_FEATURES


def parse_row(line):
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


def main():
    args = parse_args()
    model, features = load_model(args.model)

    print("Diagnostic mode. Make one gesture and hold it steady.")
    print("Shows: predicted label, confidence, and [index,middle,ring,pinky,thumb] percents.")
    print("Press Ctrl+C to stop.")

    with serial.Serial(args.port, args.baud, timeout=1) as ser:
        time.sleep(2)
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

            x = pd.DataFrame([values], columns=features)
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(x)[0]
                classes = list(model.classes_)
                best_i = max(range(len(probs)), key=lambda i: probs[i])
                label = str(classes[best_i])
                conf = float(probs[best_i])
                top3 = sorted(zip(classes, probs), key=lambda t: t[1], reverse=True)[:3]
                top3_str = " | ".join(f"{c}:{p:.2f}" for c, p in top3)
            else:
                label = str(model.predict(x)[0])
                conf = 1.0
                top3_str = label

            percents = [int(values[i]) for i in [2, 5, 8, 11, 14]]
            print(f"{label:<12} conf={conf:.2f} percents={percents} top={top3_str}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped diagnostic.")
