from datetime import timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.core import security
from app.core.config import settings
from app.repositories.user_repository import user_repository
from app.models.user import User
from app.schemas.user import UserCreate

from app.core.logging import logger

class AuthService:
    def authenticate(self, db: Session, email: str, password: str) -> Optional[User]:
        user = user_repository.get_by_email(db, email=email)
        if not user:
            logger.warning(f"Failed login attempt for email: {email} (User not found)")
            return None
        if not security.verify_password(password, user.password_hash):
            logger.warning(f"Failed login attempt for user: {user.id} (Invalid password)")
            return None
        logger.info(f"Successful login for user: {user.id}")
        return user

    def register_user(self, db: Session, user_in: UserCreate) -> User:
        user = user_repository.create(db, obj_in=user_in)
        logger.info(f"New user registered: {user.id} with email {user.email}")
        return user

    def create_access_token(self, user_id: int) -> str:
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return security.create_access_token(
            user_id, expires_delta=access_token_expires
        )

auth_service = AuthService()
