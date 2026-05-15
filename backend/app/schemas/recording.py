from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum

class RecordingStatus(str, Enum):
    RAW = "raw"
    LABELED = "labeled"
    APPROVED = "approved"
    REJECTED = "rejected"

# Shared properties
class RecordingBase(BaseModel):
    device_id: Optional[int] = None
    gesture_id: Optional[int] = None
    sample_rate: Optional[int] = Field(None, gt=0)
    duration_ms: Optional[int] = Field(None, gt=0)
    sensor_count: Optional[int] = Field(None, gt=0)
    status: Optional[RecordingStatus] = RecordingStatus.RAW
    notes: Optional[str] = None

# Properties to receive via API on creation
class RecordingCreate(RecordingBase):
    device_id: int

class RecordingJsonUpload(BaseModel):
    device_id: int
    gesture_id: Optional[int] = None
    gesture_code: Optional[str] = None
    sample_rate: int = Field(..., gt=0)
    duration_ms: int = Field(..., gt=0)
    sensor_count: int = Field(..., gt=0)
    samples: list[list[float]]

# Properties to receive via API on update (labeling)
class RecordingUpdate(BaseModel):
    gesture_id: Optional[int] = None
    status: Optional[RecordingStatus] = None
    notes: Optional[str] = None

# Properties to return via API
class RecordingOut(RecordingBase):
    id: int
    user_id: int
    device_id: int
    file_path: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
