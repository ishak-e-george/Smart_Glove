from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.models.gesture import Gesture
from app.models.recording import Recording
from app.models.device import Device

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
