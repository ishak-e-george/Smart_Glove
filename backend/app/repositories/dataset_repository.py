from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.schemas.dataset import DatasetCreate, DatasetUpdate, DatasetItemCreate

class DatasetRepository:
    def get(self, db: Session, id: int) -> Optional[Dataset]:
        return db.get(Dataset, id)

    def get_multi(self, db: Session, skip: int = 0, limit: int = 100) -> List[Dataset]:
        return db.execute(select(Dataset).offset(skip).limit(limit)).scalars().all()

    def create_with_owner(self, db: Session, obj_in: DatasetCreate, user_id: int) -> Dataset:
        db_obj = Dataset(
            **obj_in.model_dump(),
            created_by=user_id
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Dataset, obj_in: DatasetUpdate) -> Dataset:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, id: int) -> Dataset:
        obj = db.get(Dataset, id)
        db.delete(obj)
        db.commit()
        return obj

    def create_item(self, db: Session, dataset_id: int, obj_in: DatasetItemCreate) -> DatasetItem:
        db_obj = DatasetItem(
            **obj_in.model_dump(),
            dataset_id=dataset_id
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

dataset_repository = DatasetRepository()
