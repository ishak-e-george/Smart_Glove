from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

# Shared properties
class GestureBase(BaseModel):
    code: Optional[str] = Field(None, pattern=r"^[A-Z0-9_]+$", min_length=2, max_length=50)
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = True

# Properties to receive via API on creation
class GestureCreate(GestureBase):
    code: str = Field(..., pattern=r"^[A-Z0-9_]+$", min_length=2, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)

# Properties to receive via API on update
class GestureUpdate(GestureBase):
    pass

# Properties to return via API
class Gesture(GestureBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
