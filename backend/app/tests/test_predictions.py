from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.device import Device
from app.models.gesture import Gesture
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
