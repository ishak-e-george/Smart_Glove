from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.repositories.user_repository import user_repository
from app.models.user import User
from app.schemas.user import User as UserSchema, UserUpdate

router = APIRouter()

@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user

@router.patch("/me", response_model=UserSchema)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    user = user_repository.update(db, db_obj=current_user, obj_in=user_in)
    return user
