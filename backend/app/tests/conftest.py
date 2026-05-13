import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base
from app.core.dependencies import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.core.roles import Role

# Use an in-memory SQLite database for tests
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db() -> Generator:
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db: Session) -> Generator:
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db: Session) -> User:
    user_data = {
        "email": "test@example.com",
        "password_hash": get_password_hash("password123"),
        "full_name": "Test User",
        "role": Role.USER,
        "is_active": True
    }
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def test_admin(db: Session) -> User:
    user_data = {
        "email": "admin@example.com",
        "password_hash": get_password_hash("adminpassword"),
        "full_name": "Admin User",
        "role": Role.ADMIN,
        "is_active": True
    }
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def test_researcher(db: Session) -> User:
    user_data = {
        "email": "researcher@example.com",
        "password_hash": get_password_hash("respassword"),
        "full_name": "Researcher User",
        "role": Role.RESEARCHER,
        "is_active": True
    }
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_auth_headers(user: User) -> dict:
    access_token = create_access_token(subject=user.id)
    return {"Authorization": f"Bearer {access_token}"}
