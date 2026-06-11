#!/usr/bin/env python3
"""
Train the final ASL prototype model from 5-value glove CSV data.

The model intentionally uses only the stable fingers:
index, middle, ring
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
    print("Missing dependencies. Install with: pip install pandas scikit-learn joblib")
    sys.exit(1)


FEATURES = ["index", "middle", "ring"]
ALL_SENSOR_COLUMNS = ["index", "middle", "ring", "pinky", "thumb"]
PHRASES = {
    "REST": "",
    "YES": "Yes",
    "WHERE": "Where",
    "FEEL": "Feel",
    "NAME": "Name",
}


def load_dataset(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"label", *ALL_SENSOR_COLUMNS}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing columns: {sorted(missing)}")

    df = df.dropna(subset=["label", *FEATURES]).copy()
    df["label"] = df["label"].astype(str).str.upper().str.strip()
    df = df[df["label"] != ""]

    for column in FEATURES:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=FEATURES)
    df[FEATURES] = df[FEATURES].astype(int)
    return df


def balance_dataset(df: pd.DataFrame, max_rows_per_label: int, random_state: int) -> pd.DataFrame:
    if max_rows_per_label <= 0:
        return df

    groups = []
    for _, group in df.groupby("label", sort=True):
        if len(group) > max_rows_per_label:
            group = group.sample(n=max_rows_per_label, random_state=random_state)
        groups.append(group)

    return pd.concat(groups, ignore_index=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/smart_glove_asl_words_v3.csv")
    parser.add_argument("--model-out", default="smart-glove-ai/models/asl_3finger_model.joblib")
    parser.add_argument("--clean-out", default="data/smart_glove_asl_words_v3_clean.csv")
    parser.add_argument("--max-rows-per-label", type=int, default=200)
    parser.add_argument("--test-size", type=float, default=0.25)
    parser.add_argument("--trees", type=int, default=300)
    parser.add_argument("--random-state", type=int, default=42)
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Dataset not found: {data_path}")
        return 2

    try:
        df = load_dataset(data_path)
    except ValueError as exc:
        print(str(exc))
        return 2

    df = balance_dataset(df, args.max_rows_per_label, args.random_state)
    counts = df["label"].value_counts().sort_index()

    if counts.size < 2:
        print("Need at least two labels to train.")
        return 2
    if counts.min() < 4:
        print("Every label needs at least four rows for stratified train/test split.")
        print(counts.to_string())
        return 2

    clean_path = Path(args.clean_out)
    clean_path.parent.mkdir(parents=True, exist_ok=True)
    df[["label", *FEATURES]].to_csv(clean_path, index=False)

    print("Training data:")
    print(data_path)
    print()
    print("Clean balanced dataset:")
    print(clean_path)
    print()
    print("Feature columns:")
    print(", ".join(FEATURES))
    print()
    print("Rows per label:")
    print(counts.to_string())
    print()

    X = df[FEATURES]
    y = df["label"]
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=args.trees,
        random_state=args.random_state,
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
    print()

    artifact = {
        "model": model,
        "features": FEATURES,
        "feature_columns": FEATURES,
        "labels": labels,
        "phrases": PHRASES,
        "ignored_features": ["pinky", "thumb"],
        "dataset": str(data_path),
    }

    out_path = Path(args.model_out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, out_path)
    print(f"Saved model to {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
