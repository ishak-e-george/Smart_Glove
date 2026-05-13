from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from common import DEFAULT_FEATURE_SET, get_csv_columns, get_feature_columns


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train the first smart glove gesture classifier.")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "gesture_dataset.csv",
        help="Input dataset CSV path",
    )
    parser.add_argument(
        "--model-out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "models" / "gesture_model.joblib",
        help="Output model path",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of rows reserved for testing",
    )
    parser.add_argument(
        "--feature-set",
        choices=["2", "3", "5"],
        default=DEFAULT_FEATURE_SET,
        help="Feature layout used in the dataset and model",
    )
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    if not args.csv.exists():
        print(f"Dataset not found: {args.csv}", file=sys.stderr)
        return 1

    df = pd.read_csv(args.csv)
    feature_columns = get_feature_columns(args.feature_set)
    csv_columns = get_csv_columns(args.feature_set)

    missing_columns = [column for column in csv_columns if column not in df.columns]
    if missing_columns:
        print(f"Dataset is missing required columns: {missing_columns}", file=sys.stderr)
        return 1

    if df["label"].nunique() < 2:
        print("Training requires at least two gesture labels.", file=sys.stderr)
        return 1

    print("Label counts:")
    print(df["label"].value_counts().sort_index().to_string())
    print()

    X = df[feature_columns]
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        max_depth=8,
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    print("Classification report:")
    print(classification_report(y_test, y_pred))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print()

    artifact = {
        "model": model,
        "feature_columns": feature_columns,
        "feature_set": args.feature_set,
        "labels": sorted(df["label"].unique().tolist()),
    }
    args.model_out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.model_out)
    print(f"Saved model to {args.model_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
