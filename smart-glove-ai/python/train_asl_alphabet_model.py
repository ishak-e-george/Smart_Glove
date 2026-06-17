#!/usr/bin/env python3
"""
Train a 5-finger ASL alphabet classifier.

Expected CSV columns:
    label,index,middle,ring,pinky,thumb

Labels should be A-Z, with optional REST rows. J and Z are motion letters in
real ASL, so static flex-sensor accuracy for those two labels depends heavily
on how the dataset was collected.

Example:
    python python/train_asl_alphabet_model.py ^
      --data data/external/asl_alphabet/asl_alphabet_5finger.csv ^
      --model-out models/asl_alphabet_5finger_model.joblib
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

try:
    import joblib
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import classification_report, confusion_matrix
    from sklearn.model_selection import train_test_split
except ImportError:
    print("Missing dependencies. Install with:")
    print("pip install pandas scikit-learn joblib")
    sys.exit(1)


FEATURES = ["index", "middle", "ring", "pinky", "thumb"]
ALPHABET = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
VALID_LABELS = ALPHABET | {"REST"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/external/asl_alphabet/asl_alphabet_5finger.csv")
    parser.add_argument("--model-out", default="models/asl_alphabet_5finger_model.joblib")
    parser.add_argument("--min-rows-per-label", type=int, default=50)
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Dataset not found: {data_path}")
        print("Create/import a normalized CSV with columns: label,index,middle,ring,pinky,thumb")
        return 2

    df = pd.read_csv(data_path)
    needed = set(FEATURES + ["label"])
    missing = needed - set(df.columns)
    if missing:
        print(f"Dataset missing columns: {sorted(missing)}")
        return 2

    df = df.dropna(subset=FEATURES + ["label"]).copy()
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=FEATURES)
    df["label"] = df["label"].astype(str).str.upper().str.strip()
    df = df[df["label"].isin(VALID_LABELS)]

    counts = df["label"].value_counts().sort_index()
    print("Rows per label:")
    print(counts.to_string())
    print()

    missing_letters = sorted(ALPHABET - set(counts.index))
    if missing_letters:
        print(f"Warning: missing alphabet labels: {missing_letters}")
        print()

    too_small = counts[counts < args.min_rows_per_label]
    if len(too_small):
        print("Warning: some labels have few rows:")
        print(too_small.to_string())
        print()

    if df["label"].nunique() < 2:
        print("Need at least 2 labels to train.")
        return 2

    X = df[FEATURES].astype(float)
    y = df["label"]
    stratify = y if counts.min() >= 4 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=stratify
    )

    model = RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced",
        min_samples_leaf=2,
    )
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    print("Classification report:")
    print(classification_report(y_test, pred, zero_division=0))

    labels = sorted(y.unique())
    print("Confusion matrix labels:")
    print(labels)
    print(confusion_matrix(y_test, pred, labels=labels))

    artifact = {
        "model": model,
        "features": FEATURES,
        "labels": labels,
        "phrases": {label: label for label in labels if label != "REST"},
        "label_mode": "alphabet",
    }

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, out_path)
    print()
    print(f"Saved model to {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
