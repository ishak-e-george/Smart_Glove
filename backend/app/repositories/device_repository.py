from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceUpdate

class DeviceRepository:
    def get(self, db: Session, id: int) -> Optional[Device]:
        return db.get(Device, id)

    def get_by_serial(self, db: Session, serial: str) -> Optional[Device]:
        return db.execute(select(Device).where(Device.serial_number == serial)).scalars().first()

    def get_by_user(self, db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Device]:
        return db.execute(
            select(Device).where(Device.user_id == user_id).offset(skip).limit(limit)
        ).scalars().all()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[Device]:
        return db.execute(select(Device).offset(skip).limit(limit)).scalars().all()

    def create_with_owner(self, db: Session, obj_in: DeviceCreate, user_id: int) -> Device:
        db_obj = Device(
            **obj_in.model_dump(),
            user_id=user_id
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Device, obj_in: DeviceUpdate) -> Device:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int) -> Device:
        obj = db.get(Device, id)
        db.delete(obj)
        db.commit()
        return obj

device_repository = DeviceRepository()
