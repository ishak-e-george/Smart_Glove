from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class GesturePhrase(Base):
    __tablename__ = "gesture_phrases"

    id = Column(Integer, primary_key=True, index=True)
    gesture_id = Column(Integer, ForeignKey("gestures.id"), nullable=False)
    language_code = Column(String(5), nullable=False) # en, ar, fr
    text_value = Column(String, nullable=False) # e.g., "I need water"
    audio_url = Column(String) # optional
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    gesture = relationship("Gesture", back_populates="phrases")
