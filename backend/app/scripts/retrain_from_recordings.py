# Run via: python -m app.scripts.retrain_from_recordings
from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.recording import Recording


FEATURE_COLUMNS = [
    "indexRaw",
    "indexSmooth",
    "indexPercent",
    "middleRaw",
    "middleSmooth",
    "middlePercent",
]
CSV_COLUMNS = FEATURE_COLUMNS + ["label"]


def load_training_rows(db) -> tuple[list[dict[str, object]], int, list[str]]:
    recordings = db.query(Recording).order_by(Recording.created_at.desc()).all()
    rows: list[dict[str, object]] = []
    skipped: list[str] = []

    for recording in recordings:
        try:
            payload = json.loads(Path(recording.file_path).read_text(encoding="utf-8"))
        except Exception as error:
            skipped.append(f"Recording {recording.id}: unable to read JSON ({error})")
            continue

        label = payload.get("gesture_code")
        samples = payload.get("samples")
        if not label:
            skipped.append(f"Recording {recording.id}: missing gesture_code")
            continue
        if not isinstance(samples, list):
            skipped.append(f"Recording {recording.id}: missing samples array")
            continue

        for sample in samples:
            if not isinstance(sample, list) or len(sample) != len(FEATURE_COLUMNS):
                continue
            row = dict(zip(FEATURE_COLUMNS, sample))
            row["label"] = label
            rows.append(row)

    return rows, len(recordings), skipped


def train_model(df: pd.DataFrame) -> dict[str, object]:
    labels = sorted(df["label"].unique().tolist())
    X = df[FEATURE_COLUMNS]
    y = df["label"]

    if len(labels) < 2:
        raise ValueError("Retraining requires at least two labels.")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
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

    return {
        "model": model,
        "labels": labels,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "test_rows": int(len(y_test)),
        "classification_report": classification_report(y_test, y_pred, labels=labels, zero_division=0),
        "confusion_matrix": confusion_matrix(y_test, y_pred, labels=labels),
    }


def main() -> int:
    db = SessionLocal()
    try:
        rows, recording_count, skipped = load_training_rows(db)
    finally:
        db.close()

    if not rows:
        print("Smart Glove Retraining")
        print("----------------------")
        print(f"Loaded recordings: {recording_count}")
        print("Extracted rows: 0")
        print("No valid training rows found.")
        return 1

    df = pd.DataFrame(rows, columns=CSV_COLUMNS)
    dataset_path = Path(settings.ML_DATASET_PATH)
    model_path = Path(settings.ML_MODEL_PATH)
    dataset_path.parent.mkdir(parents=True, exist_ok=True)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(dataset_path, index=False)

    label_counts = df["label"].value_counts().sort_index()
    results = train_model(df)

    artifact = {
        "model": results["model"],
        "feature_columns": FEATURE_COLUMNS,
        "feature_set": "2",
        "labels": results["labels"],
    }
    joblib.dump(artifact, model_path)

    print("Smart Glove Retraining")
    print("----------------------")
    print(f"Loaded recordings: {recording_count}")
    print(f"Extracted rows: {len(df)}")
    print("Labels:")
    for label, count in label_counts.items():
        print(f"  {label}: {count}")
    if skipped:
        print("Skipped:")
        for item in skipped[:10]:
            print(f"  {item}")
        if len(skipped) > 10:
            print(f"  ...and {len(skipped) - 10} more")
    print()
    print("Training model...")
    print(f"Saved dataset to: {dataset_path}")
    print(f"Saved model to: {model_path}")
    print()
    print("Evaluation:")
    print(f"Accuracy: {results['accuracy']:.2f}")
    print(f"Test rows: {results['test_rows']}")
    print(f"Labels: {', '.join(results['labels'])}")
    print("Confusion matrix:")
    print(results["confusion_matrix"])
    print("Classification report:")
    print(results["classification_report"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
