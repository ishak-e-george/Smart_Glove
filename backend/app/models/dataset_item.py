from sqlalchemy import Column, Integer, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class DatasetItem(Base):
    __tablename__ = "dataset_items"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    recording_id = Column(Integer, ForeignKey("recordings.id"), nullable=False)
    gesture_id = Column(Integer, ForeignKey("gestures.id"), nullable=False)
    
    label_confidence = Column(Float, default=1.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dataset = relationship("Dataset", back_populates="items")
    recording = relationship("Recording")
    gesture = relationship("Gesture")
