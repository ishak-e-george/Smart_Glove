import json
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.logging import logger
from app.repositories.gesture_repository import gesture_repository
from app.repositories.prediction_repository import prediction_repository
from app.repositories.recording_repository import recording_repository
from app.schemas.gesture import GestureCreate
from app.schemas.prediction import PredictionCreate


MODEL_LABEL_TO_GESTURE = {
    "INDEX_BENT": ("YES", "Yes"),
    "MIDDLE_BENT": ("NO", "No"),
    "BOTH_BENT": ("HELP", "Help"),
    "INDEX_HALF": ("WATER", "Water"),
    "REST": ("REST", "Rest"),
}


class MLService:
    _artifact: Dict[str, Any] | None = None
    _artifact_path: str | None = None

    def _load_artifact(self) -> Dict[str, Any]:
        try:
            import joblib
        except ImportError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ML dependencies are not installed. Run pip install -r requirements.txt.",
            ) from error

        model_path = str(Path(settings.ML_MODEL_PATH).resolve())
        if self._artifact is not None and self._artifact_path == model_path:
            return self._artifact

        path = Path(model_path)
        if not path.exists():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"ML model not found: {path}",
            )

        artifact = joblib.load(path)
        if "model" not in artifact or "feature_columns" not in artifact:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ML model artifact is missing required metadata.",
            )

        self._artifact = artifact
        self._artifact_path = model_path
        return artifact

    def _read_recording_payload(self, file_path: str) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recording file not found: {file_path}",
            )

        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Recording file is not valid JSON: {error}",
            ) from error

    def _feature_frame_from_payload(
        self,
        payload: Dict[str, Any],
        feature_columns: List[str],
    ) -> Any:
        try:
            import pandas as pd
        except ImportError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ML dependencies are not installed. Run pip install -r requirements.txt.",
            ) from error

        samples = payload.get("samples")
        if not isinstance(samples, list) or not samples:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Recording JSON must contain a non-empty samples array.",
            )

        rows: list[list[float]] = []
        for sample in samples:
            if isinstance(sample, dict):
                try:
                    rows.append([float(sample[column]) for column in feature_columns])
                except KeyError as error:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Sample is missing feature column: {error.args[0]}",
                    ) from error
            elif isinstance(sample, list) and len(sample) == len(feature_columns):
                rows.append([float(value) for value in sample])

        if not rows:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Recording samples do not match the trained model feature layout. "
                    f"Expected {len(feature_columns)} values per sample: {feature_columns}"
                ),
            )

        frame = pd.DataFrame(rows, columns=feature_columns)
        averaged_row = frame.mean(axis=0).to_frame().T
        return averaged_row

    def _resolve_gesture_id(self, db: Session, label: str) -> int:
        code, display_name = MODEL_LABEL_TO_GESTURE.get(label, (label, label.replace("_", " ").title()))
        gesture = gesture_repository.get_by_code(db, code=code)
        if gesture:
            return gesture.id

        gesture = gesture_repository.create(
            db,
            obj_in=GestureCreate(
                code=code,
                display_name=display_name,
                description=f"Auto-created from ML model label {label}.",
            ),
        )
        return gesture.id

    def predict_gesture(
        self, 
        db: Session, 
        recording_id: int, 
        device_id: int, 
        user_id: int
    ) -> Dict[str, Any]:
        logger.info(f"Running inference for recording: {recording_id} on device: {device_id}")

        recording = recording_repository.get(db, id=recording_id)
        if not recording:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recording not found")
        if recording.device_id != device_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recording does not belong to the requested device.",
            )

        artifact = self._load_artifact()
        model = artifact["model"]
        feature_columns = artifact["feature_columns"]
        payload = self._read_recording_payload(recording.file_path)
        feature_row = self._feature_frame_from_payload(payload, feature_columns)

        label = str(model.predict(feature_row)[0])
        confidence = 1.0
        if hasattr(model, "predict_proba"):
            confidence = float(max(model.predict_proba(feature_row)[0]))

        gesture_id = self._resolve_gesture_id(db, label)

        prediction_in = PredictionCreate(
            device_id=device_id,
            predicted_gesture_id=gesture_id,
            confidence=confidence,
            source_type="inference",
            raw_input_ref=f"recording_id:{recording_id}"
        )
        
        prediction = prediction_repository.create_with_owner(
            db, obj_in=prediction_in, user_id=user_id
        )
        
        return {
            "prediction_id": prediction.id,
            "gesture_id": prediction.predicted_gesture_id,
            "model_label": label,
            "confidence": prediction.confidence
        }

ml_service = MLService()
