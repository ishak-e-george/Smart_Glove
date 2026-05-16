from pathlib import Path
from typing import Any, Dict

from app.core.config import settings


class ModelEvaluationService:
    def evaluate_current_model(self) -> Dict[str, Any]:
        model_path = Path(settings.ML_MODEL_PATH)
        dataset_path = Path(settings.ML_DATASET_PATH)

        if not model_path.exists():
            return {
                "status": "unavailable",
                "reason": f"Model not found: {model_path}",
            }

        if not dataset_path.exists():
            return {
                "status": "unavailable",
                "reason": f"Dataset not found: {dataset_path}",
            }

        try:
            import joblib
            import pandas as pd
            from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
            from sklearn.model_selection import train_test_split
        except ImportError as error:
            return {
                "status": "unavailable",
                "reason": f"ML dependencies are not installed: {error}",
            }

        try:
            artifact = joblib.load(model_path)
            model = artifact["model"]
            feature_columns = artifact["feature_columns"]
            feature_set = artifact.get("feature_set")
            df = pd.read_csv(dataset_path)
        except Exception as error:
            return {
                "status": "unavailable",
                "reason": f"Unable to load model or dataset: {error}",
            }

        missing_columns = [column for column in feature_columns + ["label"] if column not in df.columns]
        if missing_columns:
            return {
                "status": "unavailable",
                "reason": f"Dataset is missing columns: {missing_columns}",
            }

        label_counts = {
            str(label): int(count)
            for label, count in df["label"].value_counts().sort_index().items()
        }

        if df["label"].nunique() < 2:
            return {
                "status": "unavailable",
                "reason": "Evaluation requires at least two labels.",
                "label_counts": label_counts,
            }

        labels = sorted(df["label"].unique().tolist())
        X = df[feature_columns]
        y = df["label"]

        try:
            _, X_test, _, y_test = train_test_split(
                X,
                y,
                test_size=0.2,
                random_state=42,
                stratify=y,
            )
        except ValueError as error:
            return {
                "status": "unavailable",
                "reason": f"Unable to split dataset for evaluation: {error}",
                "label_counts": label_counts,
            }

        y_pred = model.predict(X_test)
        report = classification_report(y_test, y_pred, labels=labels, output_dict=True, zero_division=0)
        matrix = confusion_matrix(y_test, y_pred, labels=labels)

        return {
            "status": "ready",
            "accuracy": float(accuracy_score(y_test, y_pred)),
            "feature_set": feature_set,
            "feature_columns": feature_columns,
            "labels": labels,
            "label_counts": label_counts,
            "test_rows": int(len(y_test)),
            "classification_report": report,
            "confusion_matrix": matrix.tolist(),
        }


model_evaluation_service = ModelEvaluationService()
