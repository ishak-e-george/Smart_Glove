from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Gesture(Base):
    __tablename__ = "gestures"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False) # e.g., HELP, WATER
    display_name = Column(String, nullable=False)
    description = Column(String)
    is_active = Column(Boolean(), default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    phrases = relationship("GesturePhrase", back_populates="gesture", cascade="all, delete-orphan")
