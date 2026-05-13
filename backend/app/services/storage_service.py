import os
import shutil
from pathlib import Path
from typing import Any
from fastapi import UploadFile
import uuid

# Base directory for storing uploads
UPLOAD_DIR = Path("uploads/recordings")

def save_recording_file(file: UploadFile, user_id: int) -> str:
    # Ensure upload directory exists
    user_upload_dir = UPLOAD_DIR / str(user_id)
    os.makedirs(user_upload_dir, exist_ok=True)
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = user_upload_dir / unique_filename
    
    # Save the file
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return str(file_path)

def delete_recording_file(file_path: str) -> None:
    if os.path.exists(file_path):
        os.remove(file_path)
