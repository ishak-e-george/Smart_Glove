from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime

# Dataset Item Schemas
class DatasetItemBase(BaseModel):
    recording_id: int
    gesture_id: int
    label_confidence: Optional[float] = 1.0

class DatasetItemCreate(DatasetItemBase):
    pass

class DatasetItem(DatasetItemBase):
    id: int
    dataset_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Dataset Schemas
class DatasetBase(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    source_type: Optional[str] = None
    status: Optional[str] = "draft"

class DatasetCreate(DatasetBase):
    name: str
    version: str
    source_type: str

class DatasetUpdate(DatasetBase):
    pass

class Dataset(DatasetBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DatasetOutWithItems(Dataset):
    items: List[DatasetItem] = []
