import json
from typing import List, Dict, Any
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.models.recording import Recording
from app.core.roles import Role
from app.core.logging import logger


TWO_FINGER_COLUMNS = [
    "indexRaw",
    "indexSmooth",
    "indexPercent",
    "middleRaw",
    "middleSmooth",
    "middlePercent",
]

class DatasetExportService:
    def export_dataset_manifest(self, db: Session, dataset_id: int) -> Dict[str, Any]:
        """
        Generates a JSON manifest of all recordings in a dataset for ML training.
        """
        dataset = db.get(Dataset, dataset_id)
        if not dataset:
            return {}

        logger.info(f"Exporting manifest for dataset: {dataset_id} ({dataset.name})")

        items = dataset.items
        manifest = {
            "dataset_id": dataset.id,
            "name": dataset.name,
            "version": dataset.version,
            "exported_at": str(dataset.updated_at or dataset.created_at),
            "samples": []
        }

        for item in items:
            recording = item.recording
            gesture = item.gesture
            manifest["samples"].append({
                "recording_id": recording.id,
                "file_path": recording.file_path,
                "gesture_code": gesture.code,
                "label_confidence": item.label_confidence,
                "sensor_count": recording.sensor_count,
                "sample_rate": recording.sample_rate
            })

        return manifest

    def export_recordings_training_data(
        self,
        db: Session,
        user_id: int,
        role: str,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        stmt = select(Recording).order_by(Recording.created_at.desc()).limit(limit)
        if role not in [Role.ADMIN, Role.RESEARCHER]:
            stmt = stmt.where(Recording.user_id == user_id)

        recordings = db.execute(stmt).scalars().all()
        rows: list[dict[str, Any]] = []
        manifest_samples: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []

        for recording in recordings:
            try:
                payload = json.loads(Path(recording.file_path).read_text(encoding="utf-8"))
            except Exception as error:
                skipped.append({
                    "recording_id": recording.id,
                    "reason": f"Unable to read recording JSON: {error}",
                })
                continue

            samples = payload.get("samples")
            label = payload.get("gesture_code") or "UNLABELED"
            if not isinstance(samples, list):
                skipped.append({
                    "recording_id": recording.id,
                    "reason": "Recording JSON has no samples array.",
                })
                continue

            sample_rows = 0
            for sample in samples:
                if not isinstance(sample, list) or len(sample) != len(TWO_FINGER_COLUMNS):
                    continue
                row = dict(zip(TWO_FINGER_COLUMNS, sample))
                row["label"] = label
                row["recording_id"] = recording.id
                rows.append(row)
                sample_rows += 1

            manifest_samples.append({
                "recording_id": recording.id,
                "gesture_code": label,
                "file_path": recording.file_path,
                "sample_rate": recording.sample_rate,
                "duration_ms": recording.duration_ms,
                "sensor_count": recording.sensor_count,
                "rows_exported": sample_rows,
            })

        label_counts: dict[str, int] = {}
        for row in rows:
            label = str(row["label"])
            label_counts[label] = label_counts.get(label, 0) + 1

        return {
            "recording_count": len(recordings),
            "row_count": len(rows),
            "label_counts": label_counts,
            "csv_columns": TWO_FINGER_COLUMNS + ["label"],
            "csv_preview": [
                {column: row[column] for column in TWO_FINGER_COLUMNS + ["label"]}
                for row in rows[:10]
            ],
            "manifest": {
                "feature_set": "2",
                "samples": manifest_samples,
                "skipped": skipped,
            },
        }

dataset_export_service = DatasetExportService()
