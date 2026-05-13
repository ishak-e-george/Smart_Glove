from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.gesture import Gesture
from app.models.phrase import GesturePhrase

def test_create_phrase_researcher(client: TestClient, test_researcher, db: Session):
    gesture = Gesture(display_name="Water", code="WATER_01")
    db.add(gesture)
    db.commit()
    
    headers = get_auth_headers(test_researcher)
    data = {
        "gesture_id": gesture.id,
        "language_code": "en",
        "text_value": "I need water"
    }
    response = client.post(f"{settings.API_V1_STR}/phrases/", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["text_value"] == "I need water"

def test_read_phrases_by_gesture(client: TestClient, test_user, db: Session):
    gesture = Gesture(display_name="Help", code="HELP_01")
    db.add(gesture)
    db.commit()
    
    phrase = GesturePhrase(gesture_id=gesture.id, language_code="en", text_value="Help me")
    db.add(phrase)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.get(f"{settings.API_V1_STR}/phrases/by-gesture/{gesture.id}", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert len(content) == 1
    assert content[0]["text_value"] == "Help me"

def test_update_phrase_admin(client: TestClient, test_admin, db: Session):
    gesture = Gesture(display_name="Food", code="FOOD_01")
    db.add(gesture)
    db.commit()
    
    phrase = GesturePhrase(gesture_id=gesture.id, language_code="en", text_value="Old Text")
    db.add(phrase)
    db.commit()
    
    headers = get_auth_headers(test_admin)
    data = {"text_value": "New Text"}
    response = client.patch(f"{settings.API_V1_STR}/phrases/{phrase.id}", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["text_value"] == "New Text"

def test_delete_phrase_forbidden_for_user(client: TestClient, test_user, db: Session):
    gesture = Gesture(display_name="Test", code="TEST_01")
    db.add(gesture)
    db.commit()
    
    phrase = GesturePhrase(gesture_id=gesture.id, language_code="en", text_value="To delete")
    db.add(phrase)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.delete(f"{settings.API_V1_STR}/phrases/{phrase.id}", headers=headers)
    assert response.status_code == 403
