from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.device import Device
from app.models.gesture import Gesture
from app.models.recording import Recording
from app.models.prediction import Prediction

def test_create_prediction_own_device(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_P_1", device_type="glove", user_id=test_user.id)
    db.add(device)
    gesture = Gesture(display_name="G1", code="G1")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_user)
    data = {
        "device_id": device.id,
        "predicted_gesture_id": gesture.id,
        "confidence": 0.85
    }
    response = client.post(f"{settings.API_V1_STR}/predictions/", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["confidence"] == 0.85

def test_create_prediction_others_device_forbidden(client: TestClient, db: Session, test_user, test_admin):
    device = Device(device_name="D1", serial_number="SN_P_2", device_type="glove", user_id=test_admin.id)
    db.add(device)
    gesture = Gesture(display_name="G1", code="G1")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_user)
    data = {
        "device_id": device.id,
        "predicted_gesture_id": gesture.id,
        "confidence": 0.85
    }
    response = client.post(f"{settings.API_V1_STR}/predictions/", json=data, headers=headers)
    assert response.status_code == 403

def test_create_prediction_invalid_confidence(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_P_3", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_user)
    data = {
        "device_id": device.id,
        "predicted_gesture_id": 1,
        "confidence": 1.5 # Invalid
    }
    response = client.post(f"{settings.API_V1_STR}/predictions/", json=data, headers=headers)
    assert response.status_code == 422

def test_read_predictions_filtered(client: TestClient, db: Session, test_user):
    device = Device(device_name="D1", serial_number="SN_P_4", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    prediction = Prediction(user_id=test_user.id, device_id=device.id, predicted_gesture_id=1, confidence=0.9)
    db.add(prediction)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.get(f"{settings.API_V1_STR}/predictions/?device_id={device.id}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1
    assert response.json()[0]["device_id"] == device.id

def test_create_prediction_from_recording(client: TestClient, db: Session, test_user, monkeypatch):
    device = Device(device_name="D1", serial_number="SN_P_5", device_type="glove", user_id=test_user.id)
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
    db.refresh(recording)

    def fake_predict_gesture(db, recording_id: int, device_id: int, user_id: int):
        return {
            "prediction_id": 123,
            "gesture_id": 456,
            "model_label": "BOTH_BENT",
            "confidence": 0.91,
        }

    monkeypatch.setattr(
        "app.api.v1.endpoints.predictions.ml_service.predict_gesture",
        fake_predict_gesture,
    )

    headers = get_auth_headers(test_user)
    response = client.post(
        f"{settings.API_V1_STR}/predictions/from-recording/{recording.id}",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["model_label"] == "BOTH_BENT"
    assert response.json()["confidence"] == 0.91
