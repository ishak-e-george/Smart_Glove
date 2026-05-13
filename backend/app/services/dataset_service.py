from typing import List, Optional
from sqlalchemy.orm import Session
from app.repositories.dataset_repository import dataset_repository
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.schemas.dataset import DatasetCreate, DatasetUpdate, DatasetItemCreate

from app.core.roles import Role

class DatasetService:
    def get_datasets(self, db: Session, user_id: int, role: str, skip: int = 0, limit: int = 100) -> List[Dataset]:
        if role in [Role.ADMIN, Role.RESEARCHER]:
            return dataset_repository.get_multi(db, skip=skip, limit=limit)
        return dataset_repository.get_by_user(db, user_id=user_id, skip=skip, limit=limit)

    def get_dataset(self, db: Session, id: int) -> Optional[Dataset]:
        return dataset_repository.get(db, id=id)

    def create_dataset(self, db: Session, dataset_in: DatasetCreate, user_id: int) -> Dataset:
        return dataset_repository.create_with_owner(db, obj_in=dataset_in, user_id=user_id)

    def update_dataset(self, db: Session, id: int, dataset_in: DatasetUpdate) -> Optional[Dataset]:
        db_obj = dataset_repository.get(db, id=id)
        if not db_obj:
            return None
        return dataset_repository.update(db, db_obj=db_obj, obj_in=dataset_in)

    def delete_dataset(self, db: Session, id: int) -> Optional[Dataset]:
        db_obj = dataset_repository.get(db, id=id)
        if not db_obj:
            return None
        return dataset_repository.remove(db, id=id)

    def add_item_to_dataset(self, db: Session, dataset_id: int, item_in: DatasetItemCreate) -> Optional[DatasetItem]:
        dataset = dataset_repository.get(db, id=dataset_id)
        if not dataset:
            return None
        return dataset_repository.create_item(db, dataset_id=dataset_id, obj_in=item_in)

dataset_service = DatasetService()
