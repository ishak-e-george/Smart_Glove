from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.gesture import Gesture

def test_create_gesture_admin(client: TestClient, test_admin):
    headers = get_auth_headers(test_admin)
    data = {"display_name": "Wave", "code": "WAVE_TEST", "description": "Admin created gesture"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["code"] == "WAVE_TEST"

def test_create_gesture_researcher(client: TestClient, test_researcher):
    headers = get_auth_headers(test_researcher)
    data = {"display_name": "Pinch", "code": "PINCH_TEST", "description": "Researcher created gesture"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["code"] == "PINCH_TEST"

def test_create_gesture_user_forbidden(client: TestClient, test_user):
    headers = get_auth_headers(test_user)
    data = {"display_name": "Swipe", "code": "SWIPE_TEST"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 403

def test_create_gesture_duplicate_code(client: TestClient, test_admin, db: Session):
    # Setup existing gesture
    gesture = Gesture(display_name="Existing", code="DUP_CODE")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_admin)
    data = {"display_name": "New", "code": "DUP_CODE"}
    response = client.post(f"{settings.API_V1_STR}/gestures/", json=data, headers=headers)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_read_gestures(client: TestClient, test_user, db: Session):
    gesture = Gesture(display_name="Read Test", code="READ_01")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.get(f"{settings.API_V1_STR}/gestures/", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert len(content) >= 1
    assert any(g["code"] == "READ_01" for g in content)

def test_update_gesture_researcher(client: TestClient, test_researcher, db: Session):
    gesture = Gesture(display_name="Old Name", code="UPDATE_TEST")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_researcher)
    data = {"display_name": "New Name"}
    response = client.patch(f"{settings.API_V1_STR}/gestures/{gesture.id}", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["display_name"] == "New Name"

def test_delete_gesture_admin(client: TestClient, test_admin, db: Session):
    gesture = Gesture(display_name="Delete Me", code="DEL_TEST")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_admin)
    response = client.delete(f"{settings.API_V1_STR}/gestures/{gesture.id}", headers=headers)
    assert response.status_code == 200
    
    # Verify deleted
    assert db.get(Gesture, gesture.id) is None
