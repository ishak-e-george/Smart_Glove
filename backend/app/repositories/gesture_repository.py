from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.gesture import Gesture
from app.schemas.gesture import GestureCreate, GestureUpdate

class GestureRepository:
    def get(self, db: Session, id: int) -> Optional[Gesture]:
        return db.get(Gesture, id)

    def get_by_code(self, db: Session, code: str) -> Optional[Gesture]:
        return db.execute(select(Gesture).where(Gesture.code == code)).scalars().first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[Gesture]:
        return db.execute(select(Gesture).offset(skip).limit(limit)).scalars().all()

    def create(self, db: Session, obj_in: GestureCreate) -> Gesture:
        db_obj = Gesture(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Gesture, obj_in: GestureUpdate) -> Gesture:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int) -> Gesture:
        obj = db.get(Gesture, id)
        db.delete(obj)
        db.commit()
        return obj

gesture_repository = GestureRepository()
