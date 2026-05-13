from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.dependencies import get_db, get_current_active_admin
from app.models.user import User
from app.models.device import Device
from app.models.recording import Recording
from app.models.prediction import Prediction
from app.models.gesture import Gesture

router = APIRouter()

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
) -> Any:
    # Basic counts
    total_users = db.query(func.count(User.id)).scalar()
    total_devices = db.query(func.count(Device.id)).scalar()
    total_recordings = db.query(func.count(Recording.id)).scalar()
    total_datasets = db.query(func.count(Dataset.id)).scalar()
    total_predictions = db.query(func.count(Prediction.id)).scalar()
    
    # Grouped status
    recordings_by_status = db.query(
        Recording.status, func.count(Recording.id)
    ).group_by(Recording.status).all()

    # Predictions by gesture
    predictions_by_gesture = db.query(
        Gesture.display_name, func.count(Prediction.id)
    ).join(Prediction, Prediction.predicted_gesture_id == Gesture.id)\
     .group_by(Gesture.display_name).all()

    # Recent activity (Top 5)
    recent_recordings = db.query(Recording).order_by(Recording.created_at.desc()).limit(5).all()
    recent_predictions = db.query(Prediction).order_by(Prediction.created_at.desc()).limit(5).all()

    orphaned_files = recording_service.cleanup_orphaned_recordings(db, dry_run=True)
    
    return {
        "summary": {
            "total_users": total_users,
            "total_devices": total_devices,
            "total_recordings": total_recordings,
            "total_datasets": total_datasets,
            "total_predictions": total_predictions,
        },
        "recordings_by_status": dict(recordings_by_status),
        "predictions_by_gesture": dict(predictions_by_gesture),
        "orphaned_files_count": len(orphaned_files),
        "recent_activity": {
            "recordings": [
                {"id": r.id, "user_id": r.user_id, "status": r.status, "created_at": r.created_at} 
                for r in recent_recordings
            ],
            "predictions": [
                {"id": p.id, "user_id": p.id, "confidence": p.confidence, "created_at": p.created_at}
                for p in recent_predictions
            ]
        }
    }

@router.get("/orphans")
def list_orphans(
    delete: bool = False,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_active_admin)
) -> Any:
    orphans = recording_service.cleanup_orphaned_recordings(db, dry_run=not delete)
    return {
        "orphaned_files": orphans,
        "count": len(orphans),
        "deleted": delete
    }
