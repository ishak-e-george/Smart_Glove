from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.gesture_repository import gesture_repository
from app.models.gesture import Gesture
from app.schemas.gesture import GestureCreate, GestureUpdate

class GestureService:
    def get_gesture(self, db: Session, id: int) -> Optional[Gesture]:
        return gesture_repository.get(db, id=id)

    def get_gestures(self, db: Session, skip: int = 0, limit: int = 100) -> List[Gesture]:
        return gesture_repository.get_multi(db, skip=skip, limit=limit)

    def create_gesture(self, db: Session, gesture_in: GestureCreate) -> Gesture:
        return gesture_repository.create(db, obj_in=gesture_in)

    def update_gesture(self, db: Session, id: int, gesture_in: GestureUpdate) -> Optional[Gesture]:
        db_obj = gesture_repository.get(db, id=id)
        if not db_obj:
            return None
        return gesture_repository.update(db, db_obj=db_obj, obj_in=gesture_in)

    def delete_gesture(self, db: Session, id: int) -> Optional[Gesture]:
        db_obj = gesture_repository.get(db, id=id)
        if not db_obj:
            return None
        return gesture_repository.remove(db, id=id)

gesture_service = GestureService()
