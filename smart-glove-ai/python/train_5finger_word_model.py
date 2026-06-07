#!/usr/bin/env python3
"""
Train a RandomForest word classifier from 5-finger glove data.

Usage:
python python/train_5finger_word_model.py --data data/raw/smart_glove_5word_dataset.csv
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/raw/smart_glove_5word_dataset.csv")
    parser.add_argument("--model-out", default="models/glove_5word_model.joblib")
    parser.add_argument("--min-rows-per-label", type=int, default=50)
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Dataset not found: {data_path}")
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

    counts = df["label"].value_counts().sort_index()
    print("Rows per label:")
    print(counts.to_string())
    print()

    too_small = counts[counts < args.min_rows_per_label]
    if len(too_small):
        print("Warning: some labels have few rows:")
        print(too_small.to_string())
        print("Training will continue, but collect more rows later if accuracy is weak.")
        print()

    X = df[FEATURES].astype(float)
    y = df["label"]

    if y.nunique() < 2:
        print("Need at least 2 labels to train.")
        return 2

    # Need at least 4 rows per label to safely do a 75/25 stratified split.
    # With fewer rows, stratify can fail trying to allocate fractional samples.
    stratify = y if counts.min() >= 4 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=stratify
    )

    model = RandomForestClassifier(
        n_estimators=250,
        random_state=42,
        class_weight="balanced",
        max_depth=None,
        min_samples_leaf=2,
    )
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    print("Classification report:")
    print(classification_report(y_test, pred, zero_division=0))

    labels = sorted(y.unique())
    cm = confusion_matrix(y_test, pred, labels=labels)
    print("Confusion matrix labels:")
    print(labels)
    print(cm)

    phrases = {}
    if "phrase" in df.columns:
        for label, group in df.groupby("label"):
            vals = [str(x) for x in group["phrase"].dropna().unique() if str(x).strip()]
            phrases[label] = vals[0] if vals else ""

    artifact = {
        "model": model,
        "features": FEATURES,
        "labels": labels,
        "phrases": phrases,
    }

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, out_path)
    print()
    print(f"Saved model to {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
