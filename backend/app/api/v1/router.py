from fastapi import APIRouter
from app.api.v1.endpoints import auth, health, users, devices, gestures, phrases, recordings, datasets, predictions, admin

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(gestures.router, prefix="/gestures", tags=["gestures"])
api_router.include_router(phrases.router, prefix="/phrases", tags=["phrases"])
api_router.include_router(recordings.router, prefix="/recordings", tags=["recordings"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["predictions"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
