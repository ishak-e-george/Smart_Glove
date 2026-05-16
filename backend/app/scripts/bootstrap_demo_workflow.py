# Run via: python -m app.scripts.bootstrap_demo_workflow
from __future__ import annotations

from app.core.database import Base, SessionLocal, engine
from app.core.roles import Role
from app.repositories.device_repository import device_repository
from app.repositories.gesture_repository import gesture_repository
from app.repositories.phrase_repository import phrase_repository
from app.repositories.user_repository import user_repository
from app.schemas.device import DeviceCreate
from app.schemas.gesture import GestureCreate
from app.schemas.phrase import PhraseCreate
from app.schemas.recording import RecordingJsonUpload
from app.schemas.user import UserCreate
from app.services.ml_service import ml_service
from app.services.recording_service import recording_service


DEMO_USER_EMAIL = "user@glove.com"
DEMO_PASSWORD = "password123"
DEMO_SERIAL = "DEMO-SOFTWARE-GLOVE-001"

GESTURES = [
    ("REST", "Rest", {"en": ""}),
    ("YES", "Yes", {"en": "Yes"}),
    ("NO", "No", {"en": "No"}),
    ("HELP", "Help Needed", {"en": "I need help"}),
    ("WATER", "Thirsty", {"en": "I need water"}),
]

SAMPLE_PROFILES = {
    "REST": [1764, 1763, 2, 1913, 1912, 6],
    "INDEX_BENT": [1549, 1545, 70, 1912, 1909, 7],
    "MIDDLE_BENT": [1733, 1735, 5, 1870, 1870, 47],
}


def ensure_user(db):
    user = user_repository.get_by_email(db, email=DEMO_USER_EMAIL)
    if user:
        return user

    return user_repository.create(
        db,
        obj_in=UserCreate(
            email=DEMO_USER_EMAIL,
            password=DEMO_PASSWORD,
            full_name="Demo User",
            role=Role.USER,
        ),
    )


def ensure_gestures_and_phrases(db) -> None:
    for code, display_name, translations in GESTURES:
        gesture = gesture_repository.get_by_code(db, code=code)
        if not gesture:
            gesture = gesture_repository.create(
                db,
                obj_in=GestureCreate(code=code, display_name=display_name),
            )

        existing_languages = {
            phrase.language_code
            for phrase in phrase_repository.get_by_gesture(db, gesture_id=gesture.id)
        }
        for language_code, text_value in translations.items():
            if language_code not in existing_languages:
                phrase_repository.create(
                    db,
                    obj_in=PhraseCreate(
                        gesture_id=gesture.id,
                        language_code=language_code,
                        text_value=text_value,
                    ),
                )


def ensure_device(db, user_id: int):
    device = device_repository.get_by_serial(db, serial=DEMO_SERIAL)
    if device:
        return device

    return device_repository.create_with_owner(
        db,
        obj_in=DeviceCreate(
            device_name="Demo Software Glove",
            serial_number=DEMO_SERIAL,
            device_type="software_capture",
            firmware_version="demo",
        ),
        user_id=user_id,
    )


def build_samples(profile: list[int], count: int = 100) -> list[list[float]]:
    samples = []
    for index in range(count):
        noise = (index % 5) - 2
        samples.append([
            profile[0] + noise,
            profile[1] + noise,
            profile[2],
            profile[3] - noise,
            profile[4] - noise,
            profile[5],
        ])
    return samples


def create_recording_and_prediction(db, user_id: int, device_id: int, label: str) -> tuple[int, str]:
    payload = RecordingJsonUpload(
        device_id=device_id,
        gesture_code=label,
        sample_rate=50,
        duration_ms=2000,
        sensor_count=6,
        samples=build_samples(SAMPLE_PROFILES[label]),
    )
    recording = recording_service.upload_recording_payload(db, payload=payload, user_id=user_id)

    try:
        prediction = ml_service.predict_gesture(
            db,
            recording_id=recording.id,
            device_id=device_id,
            user_id=user_id,
        )
        return recording.id, prediction.get("model_label", "UNKNOWN")
    except Exception as error:
        return recording.id, f"PREDICTION_SKIPPED: {error}"


def main() -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = ensure_user(db)
        ensure_gestures_and_phrases(db)
        device = ensure_device(db, user_id=user.id)

        created = [
            create_recording_and_prediction(db, user_id=user.id, device_id=device.id, label=label)
            for label in SAMPLE_PROFILES
        ]

        print("Demo workflow bootstrapped.")
        print(f"Login: {DEMO_USER_EMAIL} / {DEMO_PASSWORD}")
        print(f"Device: {device.device_name} ({device.serial_number})")
        for recording_id, predicted_label in created:
            print(f"Recording #{recording_id}: {predicted_label}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
