from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.core.roles import has_access, is_privileged
from app.repositories.device_repository import device_repository
from app.models.user import User
from app.schemas.device import DeviceCreate, Device as DeviceSchema, DeviceUpdate

router = APIRouter()

@router.post("/", response_model=DeviceSchema)
def create_device(
    *,
    db: Session = Depends(get_db),
    device_in: DeviceCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    device = device_repository.get_by_serial(db, serial=device_in.serial_number)
    if device:
        raise HTTPException(status_code=400, detail="Device with this serial number already exists")
    return device_repository.create_with_owner(db, obj_in=device_in, user_id=current_user.id)

@router.get("/", response_model=List[DeviceSchema])
def read_devices(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    if is_privileged(current_user):
        return device_repository.get_multi(db, skip=skip, limit=limit)
    return device_repository.get_by_user(db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{id}", response_model=DeviceSchema)
def read_device(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    device = device_repository.get(db, id=id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not has_access(current_user, device.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return device

@router.patch("/{id}", response_model=DeviceSchema)
def update_device(
    *,
    db: Session = Depends(get_db),
    id: int,
    device_in: DeviceUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    device = device_repository.get(db, id=id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not has_access(current_user, device.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return device_repository.update(db, db_obj=device, obj_in=device_in)

@router.delete("/{id}", response_model=DeviceSchema)
def delete_device(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    device = device_repository.get(db, id=id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if not has_access(current_user, device.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    return device_repository.remove(db, id=id)
