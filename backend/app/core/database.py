from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.base import Base

if settings.SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URI, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
