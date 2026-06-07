from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

FEATURE_COLUMNS = ["indexPercent", "middlePercent", "ringPercent"]
CSV_COLUMNS = ["label", *FEATURE_COLUMNS]

PHRASE_MAPPING = {
    "REST": "",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "RING_BENT": "Help",
    "INDEX_MIDDLE_BENT": "I need water",
    "INDEX_RING_BENT": "Pain",
    "MIDDLE_RING_BENT": "Thank you",
    "ALL_THREE_BENT": "I need assistance",
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train the 3-main-finger Smart Glove model.")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "data"
        / "raw"
        / "smart_glove_3main_dataset.csv",
    )
    parser.add_argument(
        "--clean-csv",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "data"
        / "processed"
        / "smart_glove_3main_clean.csv",
    )
    parser.add_argument(
        "--model-out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "models" / "gesture_model_3main.joblib",
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--trees", type=int, default=250)
    return parser


def load_and_clean_dataset(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    missing = [column for column in CSV_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    df = df[CSV_COLUMNS].copy()
    df["label"] = df["label"].astype(str).str.strip().str.upper()
    df = df[df["label"] != ""]

    for column in FEATURE_COLUMNS:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=CSV_COLUMNS)
    df[FEATURE_COLUMNS] = df[FEATURE_COLUMNS].astype(int)
    return df.drop_duplicates()


def main() -> int:
    args = build_arg_parser().parse_args()

    if not args.csv.exists():
        print(f"Dataset not found: {args.csv}", file=sys.stderr)
        return 1

    try:
        df = load_and_clean_dataset(args.csv)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if df.empty:
        print("Dataset has no valid rows after cleaning.", file=sys.stderr)
        return 1

    label_counts = df["label"].value_counts().sort_index()
    if label_counts.size < 2:
        print("Training requires at least two labels.", file=sys.stderr)
        return 1

    if label_counts.min() < 2:
        print("Every label needs at least two rows.", file=sys.stderr)
        print(label_counts.to_string(), file=sys.stderr)
        return 1

    args.clean_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.clean_csv, index=False)

    print("Clean dataset saved:")
    print(args.clean_csv)
    print()
    print("Label counts:")
    print(label_counts.to_string())
    print()

    test_size = max(args.test_size, label_counts.size / len(df))
    if test_size >= 0.5:
        print("Dataset is too small for a useful stratified split.", file=sys.stderr)
        return 1

    X_train, X_test, y_train, y_test = train_test_split(
        df[FEATURE_COLUMNS],
        df["label"],
        test_size=test_size,
        random_state=42,
        stratify=df["label"],
    )

    model = RandomForestClassifier(
        n_estimators=args.trees,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    print(f"Accuracy: {accuracy_score(y_test, y_pred):.3f}")
    print()
    print("Classification report:")
    print(classification_report(y_test, y_pred))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print()

    artifact = {
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "feature_set": "3main",
        "labels": sorted(df["label"].unique().tolist()),
        "phrase_mapping": PHRASE_MAPPING,
    }

    args.model_out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.model_out)
    print(f"Saved model to {args.model_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
