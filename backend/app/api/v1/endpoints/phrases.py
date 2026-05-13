from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_active_admin, get_current_user, get_current_active_researcher
from app.models.user import User
from app.schemas.phrase import PhraseCreate, PhraseOut, PhraseUpdate
from app.services.phrase_service import phrase_service

router = APIRouter()

@router.post("/", response_model=PhraseOut)
def create_phrase(
    *,
    db: Session = Depends(get_db),
    phrase_in: PhraseCreate,
    current_user: User = Depends(get_current_active_researcher)
) -> Any:
    return phrase_service.create_phrase(db, phrase_in=phrase_in)

@router.get("/by-gesture/{gesture_id}", response_model=List[PhraseOut])
def read_phrases_by_gesture(
    *,
    db: Session = Depends(get_db),
    gesture_id: int,
    language_code: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    return phrase_service.get_phrases_by_gesture(db, gesture_id=gesture_id, language_code=language_code)

@router.patch("/{id}", response_model=PhraseOut)
def update_phrase(
    *,
    db: Session = Depends(get_db),
    id: int,
    phrase_in: PhraseUpdate,
    current_user: User = Depends(get_current_active_researcher)
) -> Any:
    phrase = phrase_service.update_phrase(db, id=id, phrase_in=phrase_in)
    if not phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    return phrase

@router.delete("/{id}", response_model=PhraseOut)
def delete_phrase(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_admin: User = Depends(get_current_active_admin)
) -> Any:
    phrase = phrase_service.delete_phrase(db, id=id)
    if not phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    return phrase
