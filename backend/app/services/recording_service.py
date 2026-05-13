import os
import logging
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import UploadFile
from app.repositories.recording_repository import recording_repository
from app.services import storage_service
from app.core.roles import Role
from app.models.recording import Recording
from app.schemas.recording import RecordingCreate, RecordingUpdate

logger = logging.getLogger(__name__)

class RecordingService:
    def upload_recording(
        self, 
        db: Session, 
        file: UploadFile, 
        recording_in: RecordingCreate, 
        user_id: int
    ) -> Recording:
        file_path = storage_service.save_recording_file(file, user_id)
        try:
            recording = recording_repository.create_with_owner(
                db, obj_in=recording_in, user_id=user_id, file_path=file_path
            )
            return recording
        except Exception as e:
            logger.error(f"Failed to create recording record in DB, cleaning up file: {file_path}. Error: {e}")
            storage_service.delete_recording_file(file_path)
            raise e

    def get_recordings(self, db: Session, user_id: int, role: str, skip: int = 0, limit: int = 100) -> List[Recording]:
        if role in [Role.ADMIN, Role.RESEARCHER]:
            return recording_repository.get_multi(db, skip=skip, limit=limit)
        return recording_repository.get_by_user(db, user_id=user_id, skip=skip, limit=limit)

    def get_recording(self, db: Session, id: int) -> Optional[Recording]:
        return recording_repository.get(db, id=id)

    def update_recording(self, db: Session, id: int, recording_in: RecordingUpdate) -> Optional[Recording]:
        db_obj = recording_repository.get(db, id=id)
        if not db_obj:
            return None
        return recording_repository.update(db, db_obj=db_obj, obj_in=recording_in)

    def delete_recording(self, db: Session, id: int) -> Optional[Recording]:
        db_obj = recording_repository.get(db, id=id)
        if not db_obj:
            return None
        
        file_path = db_obj.file_path
        # Delete from DB first
        deleted_obj = recording_repository.remove(db, id=id)
        
        # Then try to delete file
        try:
            storage_service.delete_recording_file(file_path)
        except Exception as e:
            logger.error(f"Failed to delete physical file {file_path} after DB record removal: {e}")
            
        return deleted_obj

    def cleanup_orphaned_recordings(self, db: Session, dry_run: bool = True) -> List[str]:
        """Find and optionally delete files that are not referenced in the database."""
        # 1. Get all file paths from DB
        all_recordings = recording_repository.get_multi(db, limit=10000)
        db_file_paths = {os.path.abspath(r.file_path) for r in all_recordings}
        
        orphans = []
        upload_base = storage_service.UPLOAD_DIR
        
        if not os.path.exists(upload_base):
            return []

        for root, dirs, files in os.walk(upload_base):
            for file in files:
                full_path = os.path.abspath(os.path.join(root, file))
                if full_path not in db_file_paths:
                    orphans.append(full_path)
                    if not dry_run:
                        try:
                            os.remove(full_path)
                            logger.info(f"Deleted orphaned file: {full_path}")
                        except Exception as e:
                            logger.error(f"Failed to delete orphaned file {full_path}: {e}")
                            
        return orphans

recording_service = RecordingService()
