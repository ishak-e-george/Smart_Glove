from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

# Shared properties
class PredictionBase(BaseModel):
    device_id: int
    predicted_gesture_id: int
    confidence: float = Field(..., ge=0.0, le=1.0)
    source_type: Optional[str] = "live"
    raw_input_ref: Optional[str] = None

# Properties to receive via API on creation
class PredictionCreate(PredictionBase):
    pass

# Properties to return via API
class Prediction(PredictionBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
