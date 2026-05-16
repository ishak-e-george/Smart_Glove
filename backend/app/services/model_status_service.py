from pathlib import Path
from typing import Any, Dict

from app.core.config import settings


TARGET_GESTURE_OUTPUTS = {
    "REST": "",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "BOTH_BENT": "Help",
    "INDEX_HALF": "Water",
}


class ModelStatusService:
    def get_status(self) -> Dict[str, Any]:
        model_status = self._read_model_status()
        dataset_counts = self._read_dataset_counts()

        trained_labels = model_status.get("labels") or sorted(dataset_counts.keys())
        pending_labels = [
            label for label in TARGET_GESTURE_OUTPUTS
            if label not in trained_labels and label != "REST"
        ]

        return {
            "trained_model": model_status,
            "dataset_counts": dataset_counts,
            "ready_labels": [
                {
                    "code": label,
                    "output": TARGET_GESTURE_OUTPUTS.get(label, label.replace("_", " ").title()),
                    "samples": dataset_counts.get(label, 0),
                    "status": "ready",
                }
                for label in trained_labels
            ],
            "pending_labels": [
                {
                    "code": label,
                    "output": TARGET_GESTURE_OUTPUTS[label],
                    "required_action": "Collect real samples and retrain the model.",
                }
                for label in pending_labels
            ],
        }

    def _read_model_status(self) -> Dict[str, Any]:
        model_path = Path(settings.ML_MODEL_PATH)
        status: Dict[str, Any] = {
            "path": str(model_path),
            "exists": model_path.exists(),
            "feature_set": None,
            "feature_columns": [],
            "labels": [],
        }

        if not model_path.exists():
            return status

        try:
            import joblib

            artifact = joblib.load(model_path)
            status["feature_set"] = artifact.get("feature_set")
            status["feature_columns"] = artifact.get("feature_columns", [])
            status["labels"] = artifact.get("labels", [])
        except Exception as error:
            status["load_error"] = str(error)

        return status

    def _read_dataset_counts(self) -> Dict[str, int]:
        dataset_path = Path(settings.ML_DATASET_PATH)
        if not dataset_path.exists():
            return {}

        try:
            import pandas as pd

            df = pd.read_csv(dataset_path)
            if "label" not in df.columns:
                return {}
            return {
                str(label): int(count)
                for label, count in df["label"].value_counts().sort_index().items()
            }
        except Exception:
            return {}


model_status_service = ModelStatusService()
