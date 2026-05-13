from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.tests.conftest import get_auth_headers
from app.models.device import Device

def test_create_device(client: TestClient, test_user):
    headers = get_auth_headers(test_user)
    data = {"device_name": "Test Device", "serial_number": "SN123456", "device_type": "glove"}
    response = client.post(f"{settings.API_V1_STR}/devices/", json=data, headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert content["device_name"] == data["device_name"]
    assert content["user_id"] == test_user.id

def test_read_own_devices(client: TestClient, db: Session, test_user):
    # Create a device for the user
    device = Device(device_name="My Device", serial_number="SN999", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.get(f"{settings.API_V1_STR}/devices/", headers=headers)
    assert response.status_code == 200
    content = response.json()
    assert len(content) >= 1
    assert any(d["serial_number"] == "SN999" for d in content)

def test_user_cannot_read_others_device(client: TestClient, db: Session, test_user, test_admin):
    # Create a device for admin
    device = Device(device_name="Admin Device", serial_number="SN_ADMIN", device_type="glove", user_id=test_admin.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.get(f"{settings.API_V1_STR}/devices/{device.id}", headers=headers)
    assert response.status_code == 403

def test_admin_can_read_any_device(client: TestClient, db: Session, test_user, test_admin):
    # Create a device for user
    device = Device(device_name="User Device", serial_number="SN_USER", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_admin)
    response = client.get(f"{settings.API_V1_STR}/devices/{device.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["serial_number"] == "SN_USER"

def test_update_own_device(client: TestClient, db: Session, test_user):
    device = Device(device_name="Old Name", serial_number="SN_OLD", device_type="glove", user_id=test_user.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_user)
    data = {"device_name": "New Name"}
    response = client.patch(f"{settings.API_V1_STR}/devices/{device.id}", json=data, headers=headers)
    assert response.status_code == 200
    assert response.json()["device_name"] == "New Name"

def test_user_cannot_delete_others_device(client: TestClient, db: Session, test_user, test_admin):
    device = Device(device_name="Admin Device", serial_number="SN_ADMIN_2", device_type="glove", user_id=test_admin.id)
    db.add(device)
    db.commit()
    
    headers = get_auth_headers(test_user)
    response = client.delete(f"{settings.API_V1_STR}/devices/{device.id}", headers=headers)
    assert response.status_code == 403
