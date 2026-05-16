from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user, get_current_active_researcher
from app.core.roles import has_access
from app.models.user import User
from app.schemas.dataset import (
    DatasetCreate, 
    Dataset as DatasetSchema, 
    DatasetUpdate, 
    DatasetItemCreate, 
    DatasetItem as DatasetItemSchema,
    DatasetOutWithItems
)
from app.services.dataset_service import dataset_service
from app.services.model_status_service import model_status_service

from app.services.dataset_export_service import dataset_export_service

router = APIRouter()

@router.get("/status/model", response_model=Dict[str, Any])
def read_model_status(
    current_user: User = Depends(get_current_user)
) -> Any:
    return model_status_service.get_status()

@router.get("/export/recordings", response_model=Dict[str, Any])
def export_recordings_training_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return dataset_export_service.export_recordings_training_data(
        db,
        user_id=current_user.id,
        role=current_user.role,
    )

@router.get("/{id}/export", response_model=Dict[str, Any])
def export_dataset(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    dataset = dataset_service.get_dataset(db, id=id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not has_access(current_user, dataset.created_by):
        raise HTTPException(status_code=403, detail="Not enough privileges")
        
    return dataset_export_service.export_dataset_manifest(db, dataset_id=id)

@router.post("/", response_model=DatasetSchema)
def create_dataset(
    *,
    db: Session = Depends(get_db),
    dataset_in: DatasetCreate,
    current_user: User = Depends(get_current_active_researcher)
) -> Any:
    return dataset_service.create_dataset(db, dataset_in=dataset_in, user_id=current_user.id)

@router.get("/", response_model=List[DatasetSchema])
def read_datasets(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    return dataset_service.get_datasets(
        db, user_id=current_user.id, role=current_user.role, skip=skip, limit=limit
    )

@router.get("/{id}", response_model=DatasetOutWithItems)
def read_dataset(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    dataset = dataset_service.get_dataset(db, id=id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not has_access(current_user, dataset.created_by):
        raise HTTPException(status_code=403, detail="Not enough privileges")
        
    return dataset

@router.patch("/{id}", response_model=DatasetSchema)
def update_dataset(
    *,
    db: Session = Depends(get_db),
    id: int,
    dataset_in: DatasetUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    dataset = dataset_service.get_dataset(db, id=id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not has_access(current_user, dataset.created_by):
        raise HTTPException(status_code=403, detail="Not enough privileges")
        
    return dataset_service.update_dataset(db, id=id, dataset_in=dataset_in)

@router.post("/{id}/items", response_model=DatasetItemSchema)
def create_dataset_item(
    *,
    db: Session = Depends(get_db),
    id: int,
    item_in: DatasetItemCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    dataset = dataset_service.get_dataset(db, id=id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not has_access(current_user, dataset.created_by):
        raise HTTPException(status_code=403, detail="Not enough privileges")
        
    item = dataset_service.add_item_to_dataset(db, dataset_id=id, item_in=item_in)
    return item

@router.delete("/{id}", response_model=DatasetSchema)
def delete_dataset(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    dataset = dataset_service.get_dataset(db, id=id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Only creator, researcher or admin can delete
    if not has_access(current_user, dataset.created_by):
        raise HTTPException(status_code=403, detail="Not enough privileges")
        
    return dataset_service.delete_dataset(db, id=id)
