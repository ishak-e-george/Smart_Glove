from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime

# Shared properties
class PhraseBase(BaseModel):
    language_code: Optional[str] = None
    text_value: Optional[str] = None
    audio_url: Optional[str] = None

# Properties to receive via API on creation
class PhraseCreate(PhraseBase):
    gesture_id: int
    language_code: str
    text_value: str

# Properties to receive via API on update
class PhraseUpdate(PhraseBase):
    pass

# Properties to return via API
class PhraseOut(PhraseBase):
    id: int
    gesture_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
