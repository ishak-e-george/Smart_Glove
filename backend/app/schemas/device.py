from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime

# Shared properties
class DeviceBase(BaseModel):
    device_name: Optional[str] = None
    device_type: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    is_active: Optional[bool] = True

# Properties to receive via API on creation
class DeviceCreate(DeviceBase):
    device_name: str
    device_type: str
    serial_number: str

# Properties to receive via API on update
class DeviceUpdate(DeviceBase):
    pass

# Properties to return via API
class Device(DeviceBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
