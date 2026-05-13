from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    version = Column(String, nullable=False)
    description = Column(String)
    source_type = Column(String) # uploaded, recorded, generated
    status = Column(String, default="draft") # draft, training, ready
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    creator = relationship("User")
    items = relationship("DatasetItem", back_populates="dataset", cascade="all, delete-orphan")
