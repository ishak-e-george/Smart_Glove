from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_active_admin, get_current_user, get_current_active_researcher
from app.repositories.gesture_repository import gesture_repository
from app.services.gesture_service import gesture_service
from app.models.user import User
from app.schemas.gesture import GestureCreate, Gesture as GestureSchema, GestureUpdate

router = APIRouter()

@router.post("/", response_model=GestureSchema)
def create_gesture(
    *,
    db: Session = Depends(get_db),
    gesture_in: GestureCreate,
    current_user: User = Depends(get_current_active_researcher)
) -> Any:
    gesture = gesture_repository.get_by_code(db, code=gesture_in.code)
    if gesture:
        raise HTTPException(status_code=400, detail="Gesture with this code already exists")
    return gesture_service.create_gesture(db, gesture_in=gesture_in)

@router.get("/", response_model=List[GestureSchema])
def read_gestures(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    return gesture_service.get_gestures(db, skip=skip, limit=limit)

@router.get("/{id}", response_model=GestureSchema)
def read_gesture(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    gesture = gesture_service.get_gesture(db, id=id)
    if not gesture:
        raise HTTPException(status_code=404, detail="Gesture not found")
    return gesture

@router.patch("/{id}", response_model=GestureSchema)
def update_gesture(
    *,
    db: Session = Depends(get_db),
    id: int,
    gesture_in: GestureUpdate,
    current_user: User = Depends(get_current_active_researcher)
) -> Any:
    gesture = gesture_service.update_gesture(db, id=id, gesture_in=gesture_in)
    if not gesture:
        raise HTTPException(status_code=404, detail="Gesture not found")
    return gesture

@router.delete("/{id}", response_model=GestureSchema)
def delete_gesture(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_admin: User = Depends(get_current_active_admin)
) -> Any:
    gesture = gesture_service.delete_gesture(db, id=id)
    if not gesture:
        raise HTTPException(status_code=404, detail="Gesture not found")
    return gesture
