from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.core.roles import has_access
from app.models.user import User
from app.schemas.recording import RecordingOut, RecordingUpdate, RecordingCreate
from app.services.recording_service import recording_service

router = APIRouter()

@router.post("/upload", response_model=RecordingOut)
def upload_recording(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    device_id: int = Form(...),
    gesture_id: Optional[int] = Form(None),
    sample_rate: Optional[int] = Form(None),
    duration_ms: Optional[int] = Form(None),
    sensor_count: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user)
) -> Any:
    recording_in = RecordingCreate(
        device_id=device_id,
        gesture_id=gesture_id,
        sample_rate=sample_rate,
        duration_ms=duration_ms,
        sensor_count=sensor_count
    )
    return recording_service.upload_recording(
        db, file=file, recording_in=recording_in, user_id=current_user.id
    )

@router.get("/", response_model=List[RecordingOut])
def read_recordings(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    return recording_service.get_recordings(
        db, user_id=current_user.id, role=current_user.role, skip=skip, limit=limit
    )

@router.get("/{id}", response_model=RecordingOut)
def read_recording(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    recording = recording_service.get_recording(db, id=id)
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    if not has_access(current_user, recording.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    
    return recording

@router.patch("/{id}/label", response_model=RecordingOut)
def label_recording(
    *,
    db: Session = Depends(get_db),
    id: int,
    recording_in: RecordingUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    recording = recording_service.get_recording(db, id=id)
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    if not has_access(current_user, recording.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    
    return recording_service.update_recording(db, id=id, recording_in=recording_in)

@router.delete("/{id}", response_model=RecordingOut)
def delete_recording(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: User = Depends(get_current_user)
) -> Any:
    recording = recording_service.get_recording(db, id=id)
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    if not has_access(current_user, recording.user_id):
        raise HTTPException(status_code=403, detail="Not enough privileges")
    
    return recording_service.delete_recording(db, id=id)
