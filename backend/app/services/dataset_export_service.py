import json
import os
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.core.logging import logger

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

dataset_export_service = DatasetExportService()
