from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.recording import Recording
from app.schemas.recording import RecordingCreate, RecordingUpdate

class RecordingRepository:
    def get(self, db: Session, id: int) -> Optional[Recording]:
        return db.get(Recording, id)

    def get_by_user(self, db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Recording]:
        return db.execute(
            select(Recording).where(Recording.user_id == user_id).offset(skip).limit(limit)
        ).scalars().all()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[Recording]:
        return db.execute(select(Recording).offset(skip).limit(limit)).scalars().all()

    def create_with_owner(self, db: Session, obj_in: RecordingCreate, user_id: int, file_path: str) -> Recording:
        obj_data = obj_in.model_dump()
        obj_data["status"] = "labeled" if obj_in.gesture_id else "raw"
        db_obj = Recording(
            **obj_data,
            user_id=user_id,
            file_path=file_path
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Recording, obj_in: RecordingUpdate) -> Recording:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int) -> Recording:
        obj = db.get(Recording, id)
        db.delete(obj)
        db.commit()
        return obj

recording_repository = RecordingRepository()
