from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash

class UserRepository:
    def get(self, db: Session, id: int) -> Optional[User]:
        return db.get(User, id)

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.execute(select(User).where(User.email == email)).scalars().first()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[User]:
        return db.execute(select(User).offset(skip).limit(limit)).scalars().all()

    def create(self, db: Session, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            full_name=obj_in.full_name,
            role=obj_in.role,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: User, obj_in: UserUpdate) -> User:
        update_data = obj_in.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["password_hash"] = get_password_hash(update_data["password"])
            del update_data["password"]
        
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

user_repository = UserRepository()
