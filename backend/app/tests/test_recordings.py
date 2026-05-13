import io
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.device import Device
from app.models.recording import Recording
from unittest.mock import patch

def test_upload_recording(client: TestClient, db: Session, test_user):
    # Setup device
    device = Device(device_name="D1", serial_number="SN_REC_1", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_user)
    file_content = b'{"data": [1, 2, 3]}'
    file = io.BytesIO(file_content)
    
    data = {
        "device_id": device.id,
        "sample_rate": 50,
        "duration_ms": 1000
    }
    
    with patch("app.services.recording_service.storage_service.save_recording_file", return_value="mock/path.json"):
        response = client.post(
            f"{settings.API_V1_STR}/recordings/upload",
            files={"file": ("test.json", file, "application/json")},
            data=data,
            headers=headers
        )
    
    assert response.status_code == 200
    assert response.json()["user_id"] == test_user.id
    assert response.json()["file_path"] == "mock/path.json"

def test_label_recording(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_REC_2", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    recording = Recording(user_id=test_user.id, device_id=device.id, file_path="some/path.json")
    db.add(recording)
    db.commit()
    
    headers = get_auth_headers(test_user)
    data = {"gesture_id": 1, "notes": "Tagged"}
    response = client.patch(f"{settings.API_V1_STR}/recordings/{recording.id}/label", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["gesture_id"] == 1
    assert response.json()["notes"] == "Tagged"

def test_delete_recording_success(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_REC_3", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    recording = Recording(user_id=test_user.id, device_id=device.id, file_path="to/delete.json")
    db.add(recording)
    db.commit()
    
    headers = get_auth_headers(test_user)
    with patch("app.services.recording_service.storage_service.delete_recording_file") as mock_delete:
        response = client.delete(f"{settings.API_V1_STR}/recordings/{recording.id}", headers=headers)
        assert response.status_code == 200
        mock_delete.assert_called_once_with("to/delete.json")
    
    assert db.get(Recording, recording.id) is None

def test_user_cannot_label_others_recording(client: TestClient, db: Session, test_user, test_admin):
    device = Device(device_name="D1", serial_number="SN_ADMIN_REC", device_type="glove", user_id=test_admin.id)
    db.add(device)
    db.commit()

    recording = Recording(user_id=test_admin.id, device_id=device.id, file_path="admin/path.json")
    db.add(recording)
    db.commit()

    headers = get_auth_headers(test_user)
    data = {"gesture_id": 1}
    response = client.patch(f"{settings.API_V1_STR}/recordings/{recording.id}/label", json=data, headers=headers)
    assert response.status_code == 403

