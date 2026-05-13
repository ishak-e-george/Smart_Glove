from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    predicted_gesture_id = Column(Integer, ForeignKey("gestures.id"), nullable=False)
    
    confidence = Column(Float, nullable=False)
    source_type = Column(String) # live, uploaded, test
    raw_input_ref = Column(String) # optional file or session ref
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    device = relationship("Device")
    gesture = relationship("Gesture")
