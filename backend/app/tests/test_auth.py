from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings

def test_register_user(client: TestClient):
    data = {"email": "newuser@example.com", "password": "password123", "full_name": "New User"}
    response = client.post(f"{settings.API_V1_STR}/auth/register", json=data)
    assert response.status_code == 200
    content = response.json()
    assert content["email"] == data["email"]
    assert "id" in content

def test_register_duplicate_email(client: TestClient, test_user):
    data = {"email": test_user.email, "password": "password123", "full_name": "New User"}
    response = client.post(f"{settings.API_V1_STR}/auth/register", json=data)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_login_success(client: TestClient, test_user):
    login_data = {
        "username": test_user.email,
        "password": "password123" # password set in conftest test_user fixture
    }
    response = client.post(f"{settings.API_V1_STR}/auth/login", data=login_data)
    assert response.status_code == 200
    content = response.json()
    assert "access_token" in content
    assert content["token_type"] == "bearer"

def test_login_wrong_password(client: TestClient, test_user):
    login_data = {
        "username": test_user.email,
        "password": "wrongpassword"
    }
    response = client.post(f"{settings.API_V1_STR}/auth/login", data=login_data)
    assert response.status_code == 400
    assert "Incorrect email or password" in response.json()["detail"]

def test_read_user_me_unauthorized(client: TestClient):
    response = client.get(f"{settings.API_V1_STR}/users/me")
    assert response.status_code == 401 # Not authenticated

def test_read_user_me_authorized(client: TestClient, test_user):
    from app.tests.conftest import get_auth_headers
    headers = get_auth_headers(test_user)
    response = client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert content["email"] == test_user.email
