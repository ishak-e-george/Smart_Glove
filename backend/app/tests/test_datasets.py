from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.models.gesture import Gesture
from app.models.recording import Recording
from app.models.device import Device
from unittest.mock import patch

def test_create_dataset_researcher(client: TestClient, test_researcher):
    headers = get_auth_headers(test_researcher)
    data = {
        "name": "Research Dataset",
        "version": "1.0.0",
        "source_type": "recorded",
        "description": "A test dataset"
    }
    response = client.post(f"{settings.API_V1_STR}/datasets/", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Research Dataset"
    assert response.json()["created_by"] == test_researcher.id

def test_read_model_status(client: TestClient, test_user, monkeypatch):
    headers = get_auth_headers(test_user)

    monkeypatch.setattr(
        "app.api.v1.endpoints.datasets.model_status_service.get_status",
        lambda: {
            "trained_model": {"feature_set": "2", "labels": ["REST"]},
            "dataset_counts": {"REST": 100},
            "ready_labels": [{"code": "REST", "output": "", "samples": 100, "status": "ready"}],
            "pending_labels": [],
        },
    )

    response = client.get(f"{settings.API_V1_STR}/datasets/status/model", headers=headers)

    assert response.status_code == 200
    assert response.json()["trained_model"]["feature_set"] == "2"

def test_read_model_evaluation(client: TestClient, test_user, monkeypatch):
    headers = get_auth_headers(test_user)

    monkeypatch.setattr(
        "app.api.v1.endpoints.datasets.model_evaluation_service.evaluate_current_model",
        lambda: {
            "status": "ready",
            "accuracy": 0.95,
            "labels": ["REST", "INDEX_BENT"],
            "confusion_matrix": [[10, 0], [1, 9]],
        },
    )

    response = client.get(f"{settings.API_V1_STR}/datasets/status/evaluation", headers=headers)

    assert response.status_code == 200
    assert response.json()["accuracy"] == 0.95

def test_export_recordings_training_data(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_EXPORT", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()

    recording = Recording(
        user_id=test_user.id,
        device_id=device.id,
        file_path="uploads/recordings/test.json",
        sample_rate=50,
        duration_ms=2000,
        sensor_count=6,
    )
    db.add(recording)
    db.commit()

    payload = {
        "gesture_code": "INDEX_BENT",
        "samples": [
            [1549, 1545, 70, 1912, 1909, 7],
            [1550, 1546, 71, 1911, 1908, 8],
        ],
    }

    class FakePath:
        def __init__(self, path):
            self.path = path

        def read_text(self, encoding="utf-8"):
            import json
            return json.dumps(payload)

    headers = get_auth_headers(test_user)
    with patch("app.services.dataset_export_service.Path", FakePath):
        response = client.get(f"{settings.API_V1_STR}/datasets/export/recordings", headers=headers)

    assert response.status_code == 200
    assert response.json()["row_count"] == 2
    assert response.json()["label_counts"]["INDEX_BENT"] == 2
    assert response.json()["csv_columns"][-1] == "label"

def test_export_recordings_training_csv(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_EXPORT_CSV", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()

    recording = Recording(
        user_id=test_user.id,
        device_id=device.id,
        file_path="uploads/recordings/test.csv.json",
        sample_rate=50,
        duration_ms=2000,
        sensor_count=6,
    )
    db.add(recording)
    db.commit()

    payload = {
        "gesture_code": "MIDDLE_BENT",
        "samples": [[1733, 1735, 5, 1870, 1870, 47]],
    }

    class FakePath:
        def __init__(self, path):
            self.path = path

        def read_text(self, encoding="utf-8"):
            import json
            return json.dumps(payload)

    headers = get_auth_headers(test_user)
    with patch("app.services.dataset_export_service.Path", FakePath):
        response = client.get(f"{settings.API_V1_STR}/datasets/export/recordings.csv", headers=headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "smart_glove_training_export.csv" in response.headers["content-disposition"]
    assert "label,indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent" in response.text
    assert "MIDDLE_BENT,1733,1735,5,1870,1870,47" in response.text

def test_create_dataset_user_forbidden(client: TestClient, test_user):
    headers = get_auth_headers(test_user)
    data = {"name": "User Dataset", "version": "1.0", "source_type": "uploaded"}
    response = client.post(f"{settings.API_V1_STR}/datasets/", json=data, headers=headers)
    assert response.status_code == 403

def test_add_item_to_dataset(client: TestClient, db: Session, test_researcher):
    # Setup
    dataset = Dataset(name="DS1", version="1", source_type="manual", created_by=test_researcher.id)
    db.add(dataset)
    gesture = Gesture(display_name="G1", code="G1")
    db.add(gesture)
    device = Device(device_name="D1", serial_number="S1", device_type="glove", user_id=test_researcher.id)
    db.add(device)
    db.commit()
    recording = Recording(user_id=test_researcher.id, device_id=device.id, file_path="p.json")
    db.add(recording)
    db.commit()
    
    headers = get_auth_headers(test_researcher)
    data = {
        "recording_id": recording.id,
        "gesture_id": gesture.id,
        "label_confidence": 0.95
    }
    response = client.post(f"{settings.API_V1_STR}/datasets/{dataset.id}/items", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["dataset_id"] == dataset.id
    assert response.json()["recording_id"] == recording.id

def test_update_dataset_owner(client: TestClient, db: Session, test_researcher):
    dataset = Dataset(name="Old", version="1", source_type="manual", created_by=test_researcher.id)
    db.add(dataset)
    db.commit()
    
    headers = get_auth_headers(test_researcher)
    response = client.patch(f"{settings.API_V1_STR}/datasets/{dataset.id}", json={"name": "New"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "New"

def test_delete_dataset_cleans_items(client: TestClient, db: Session, test_researcher):
    dataset = Dataset(name="DS_DEL", version="1", source_type="manual", created_by=test_researcher.id)
    db.add(dataset)
    db.commit()
    
    item = DatasetItem(dataset_id=dataset.id, recording_id=1, gesture_id=1)
    db.add(item)
    db.commit()
    
    headers = get_auth_headers(test_researcher)
    response = client.delete(f"{settings.API_V1_STR}/datasets/{dataset.id}", headers=headers)
    assert response.status_code == 200
    
    assert db.get(Dataset, dataset.id) is None
    assert db.get(DatasetItem, item.id) is None
