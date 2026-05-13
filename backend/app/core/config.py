import os
from dotenv import load_dotenv
from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Smart Glove API")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "yoursecretkeyhere")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "smart_glove")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    SQLALCHEMY_DATABASE_URI: str = os.getenv(
        "DATABASE_URL", 
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )

settings = Settings()
