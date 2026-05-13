from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.gesture import Gesture
from app.models.recording import Recording

def test_user_cannot_create_gesture(client: TestClient, test_user):
    headers = get_auth_headers(test_user)
    data = {"display_name": "Wave", "code": "WAVE_01", "description": "Hand waving"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 403

def test_researcher_can_create_gesture(client: TestClient, test_researcher):
    headers = get_auth_headers(test_researcher)
    data = {"display_name": "Pinch", "code": "PINCH_01", "description": "Pinching gesture"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["code"] == "PINCH_01"

def test_admin_can_create_gesture(client: TestClient, test_admin):
    headers = get_auth_headers(test_admin)
    data = {"display_name": "Swipe", "code": "SWIPE_01", "description": "Swiping gesture"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 200

def test_user_cannot_delete_others_recording(client: TestClient, db: Session, test_user, test_admin):
    from app.models.device import Device
    device = Device(device_name="D1", serial_number="S1", device_type="glove", user_id=test_admin.id)
    db.add(device)
    db.commit()
    
    # Create a recording for admin
    recording = Recording(user_id=test_admin.id, device_id=device.id, file_path="some/path.json")
    db.add(recording)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.delete(f"{settings.API_V1_STR}/recordings/{recording.id}", headers=headers)
    assert response.status_code == 403

def test_researcher_can_delete_any_recording(client: TestClient, db: Session, test_user, test_researcher):
    from app.models.device import Device
    device = Device(device_name="D2", serial_number="S2", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    # Create a recording for user
    recording = Recording(user_id=test_user.id, device_id=device.id, file_path="user/path.json")
    db.add(recording)
    db.commit()
    
    headers = get_auth_headers(test_researcher)
    # Mocking storage_service.delete_recording_file to avoid file system errors
    from unittest.mock import patch
    with patch("app.services.recording_service.storage_service.delete_recording_file"):
        response = client.delete(f"{settings.API_V1_STR}/recordings/{recording.id}", headers=headers)
    
    assert response.status_code == 200

def test_user_cannot_create_dataset(client: TestClient, test_user):
    headers = get_auth_headers(test_user)
    data = {"name": "Bad Dataset", "version": "v1", "source_type": "manual", "description": "User trying to create"}
    response = client.post(f"{settings.API_V1_STR}/datasets/", json=data, headers=headers)
    assert response.status_code == 403

def test_researcher_can_create_dataset(client: TestClient, test_researcher):
    headers = get_auth_headers(test_researcher)
    data = {"name": "Good Dataset", "version": "v1", "source_type": "manual", "description": "Researcher creating"}
    response = client.post(f"{settings.API_V1_STR}/datasets/", json=data, headers=headers)
    assert response.status_code == 200
