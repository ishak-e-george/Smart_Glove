from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.prediction import Prediction
from app.schemas.prediction import PredictionCreate

class PredictionRepository:
    def get(self, db: Session, id: int) -> Optional[Prediction]:
        return db.get(Prediction, id)

    def get_by_user(self, db: Session, user_id: int, skip: int = 0, limit: int = 100, device_id: Optional[int] = None) -> List[Prediction]:
        stmt = select(Prediction).where(Prediction.user_id == user_id)
        if device_id:
            stmt = stmt.where(Prediction.device_id == device_id)
        stmt = stmt.order_by(Prediction.created_at.desc()).offset(skip).limit(limit)
        return db.execute(stmt).scalars().all()

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100, device_id: Optional[int] = None) -> List[Prediction]:
        stmt = select(Prediction)
        if device_id:
            stmt = stmt.where(Prediction.device_id == device_id)
        stmt = stmt.order_by(Prediction.created_at.desc()).offset(skip).limit(limit)
        return db.execute(stmt).scalars().all()

    def create_with_owner(self, db: Session, obj_in: PredictionCreate, user_id: int) -> Prediction:
        db_obj = Prediction(
            **obj_in.model_dump(),
            user_id=user_id
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

prediction_repository = PredictionRepository()
