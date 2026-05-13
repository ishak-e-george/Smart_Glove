from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.core.roles import has_access
from app.repositories.device_repository import device_repository
from app.models.user import User
from app.schemas.prediction import PredictionCreate, Prediction as PredictionSchema
from app.services.prediction_service import prediction_service

router = APIRouter()

@router.post("/", response_model=PredictionSchema)
def create_prediction(
    *,
    db: Session = Depends(get_db),
    prediction_in: PredictionCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    # Check if device exists and belongs to user
    device = device_repository.get(db, id=prediction_in.device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not has_access(current_user, device.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges for this device")
        
    return prediction_service.create_prediction(db, prediction_in=prediction_in, user_id=current_user.id)

@router.get("/", response_model=List[PredictionSchema])
def read_predictions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    device_id: Optional[int] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    return prediction_service.get_predictions(
        db, user_id=current_user.id, role=current_user.role, skip=skip, limit=limit, device_id=device_id
    )

@router.get("/{id}", response_model=PredictionSchema)
def read_prediction(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    prediction = prediction_service.get_prediction(db, id=id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    
    if not has_access(current_user, prediction.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    
    return prediction
