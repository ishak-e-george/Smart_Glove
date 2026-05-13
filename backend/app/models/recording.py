from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    gesture_id = Column(Integer, ForeignKey("gestures.id"), nullable=True) # nullable if unlabeled
    
    file_path = Column(String, nullable=False)
    sample_rate = Column(Integer)
    duration_ms = Column(Integer)
    sensor_count = Column(Integer)
    
    status = Column(String, default="raw") # raw, labeled, approved, rejected
    notes = Column(String)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User")
    device = relationship("Device")
    gesture = relationship("Gesture")
