from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.prediction_repository import prediction_repository
from app.core.roles import Role
from app.models.prediction import Prediction
from app.schemas.prediction import PredictionCreate

class PredictionService:
    def create_prediction(self, db: Session, prediction_in: PredictionCreate, user_id: int) -> Prediction:
        return prediction_repository.create_with_owner(db, obj_in=prediction_in, user_id=user_id)

    def get_predictions(self, db: Session, user_id: int, role: str, skip: int = 0, limit: int = 100, device_id: Optional[int] = None) -> List[Prediction]:
        if role in [Role.ADMIN, Role.RESEARCHER]:
            return prediction_repository.get_multi(db, skip=skip, limit=limit, device_id=device_id)
        return prediction_repository.get_by_user(db, user_id=user_id, skip=skip, limit=limit, device_id=device_id)

    def get_prediction(self, db: Session, id: int) -> Optional[Prediction]:
        return prediction_repository.get(db, id=id)

prediction_service = PredictionService()
