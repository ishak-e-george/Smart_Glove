from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.phrase import GesturePhrase
from app.schemas.phrase import PhraseCreate, PhraseUpdate

class PhraseRepository:
    def get(self, db: Session, id: int) -> Optional[GesturePhrase]:
        return db.get(GesturePhrase, id)

    def get_by_gesture(self, db: Session, gesture_id: int, language_code: Optional[str] = None) -> List[GesturePhrase]:
        stmt = select(GesturePhrase).where(GesturePhrase.gesture_id == gesture_id)
        if language_code:
            stmt = stmt.where(GesturePhrase.language_code == language_code)
        return db.execute(stmt).scalars().all()

    def create(self, db: Session, obj_in: PhraseCreate) -> GesturePhrase:
        db_obj = GesturePhrase(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: GesturePhrase, obj_in: PhraseUpdate) -> GesturePhrase:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int) -> GesturePhrase:
        obj = db.get(GesturePhrase, id)
        db.delete(obj)
        db.commit()
        return obj

phrase_repository = PhraseRepository()
