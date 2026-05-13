from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.phrase_repository import phrase_repository
from app.models.phrase import GesturePhrase
from app.schemas.phrase import PhraseCreate, PhraseUpdate

class PhraseService:
    def get_phrases_by_gesture(self, db: Session, gesture_id: int, language_code: Optional[str] = None) -> List[GesturePhrase]:
        return phrase_repository.get_by_gesture(db, gesture_id=gesture_id, language_code=language_code)

    def create_phrase(self, db: Session, phrase_in: PhraseCreate) -> GesturePhrase:
        return phrase_repository.create(db, obj_in=phrase_in)

    def update_phrase(self, db: Session, id: int, phrase_in: PhraseUpdate) -> Optional[GesturePhrase]:
        db_obj = phrase_repository.get(db, id=id)
        if not db_obj:
            return None
        return phrase_repository.update(db, db_obj=db_obj, obj_in=phrase_in)

    def delete_phrase(self, db: Session, id: int) -> Optional[GesturePhrase]:
        db_obj = phrase_repository.get(db, id=id)
        if not db_obj:
            return None
        return phrase_repository.remove(db, id=id)

phrase_service = PhraseService()
