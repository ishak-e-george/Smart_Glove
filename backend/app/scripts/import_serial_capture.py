# Run via:
# python -m app.scripts.import_serial_capture --label INDEX_BENT --file hardware_samples/index_bent.txt --retrain
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

from app.core.database import Base, SessionLocal, engine
from app.core.roles import Role
from app.repositories.device_repository import device_repository
from app.repositories.gesture_repository import gesture_repository
from app.repositories.user_repository import user_repository
from app.schemas.device import DeviceCreate
from app.schemas.gesture import GestureCreate
from app.schemas.recording import RecordingJsonUpload
from app.schemas.user import UserCreate
from app.services.recording_service import recording_service


DEMO_USER_EMAIL = "user@glove.com"
DEMO_PASSWORD = "password123"
HARDWARE_SERIAL = "REAL-HARDWARE-GLOVE-001"
SAMPLE_RATE = 8
FEATURE_COUNT = 6
SUPPORTED_LABELS = {"REST", "INDEX_BENT", "MIDDLE_BENT"}
CSV_LINE_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?\s*,\s*){5}-?\d+(?:\.\d+)?\s*$")


def parse_serial_samples(text: str) -> list[list[float]]:
    samples: list[list[float]] = []

    for line in text.splitlines():
        if not CSV_LINE_RE.match(line):
            continue

        values = [float(value.strip()) for value in line.split(",")]
        if len(values) != FEATURE_COUNT:
            continue
        samples.append(values)

    return samples


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


def ensure_device(db, user_id: int):
    device = device_repository.get_by_serial(db, serial=HARDWARE_SERIAL)
    if device:
        return device

    return device_repository.create_with_owner(
        db,
        obj_in=DeviceCreate(
            device_name="Real Hardware Glove",
            serial_number=HARDWARE_SERIAL,
            device_type="arduino_serial_capture",
            firmware_version="2-finger-persistent-calibration",
        ),
        user_id=user_id,
    )


def ensure_gesture(db, label: str):
    gesture = gesture_repository.get_by_code(db, code=label)
    if gesture:
        return gesture

    display_name = label.replace("_", " ").title()
    return gesture_repository.create(
        db,
        obj_in=GestureCreate(code=label, display_name=display_name),
    )


def import_capture(label: str, samples: list[list[float]]) -> int:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = ensure_user(db)
        device = ensure_device(db, user_id=user.id)
        gesture = ensure_gesture(db, label)

        payload = RecordingJsonUpload(
            device_id=device.id,
            gesture_id=gesture.id,
            gesture_code=label,
            sample_rate=SAMPLE_RATE,
            duration_ms=int((len(samples) / SAMPLE_RATE) * 1000),
            sensor_count=FEATURE_COUNT,
            samples=samples,
        )
        recording = recording_service.upload_recording_payload(db, payload=payload, user_id=user.id)
        return recording.id
    finally:
        db.close()


def run_retrain() -> int:
    return subprocess.call([sys.executable, "-m", "app.scripts.retrain_from_recordings"])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import Arduino Serial Monitor CSV samples as a labeled recording.")
    parser.add_argument("--label", required=True, choices=sorted(SUPPORTED_LABELS))
    parser.add_argument("--file", required=True, type=Path, help="Text file copied from Serial Monitor output.")
    parser.add_argument("--retrain", action="store_true", help="Retrain model immediately after importing.")
    return parser


def main() -> int:
    args = build_parser().parse_args()

    if not args.file.exists():
        print(f"Input file not found: {args.file}")
        return 1

    samples = parse_serial_samples(args.file.read_text(encoding="utf-8"))
    if not samples:
        print("No valid 6-column CSV samples found.")
        print("Expected rows like: 1792,1807,66,1975,1978,1")
        return 1

    recording_id = import_capture(args.label, samples)

    print("Hardware serial capture imported.")
    print(f"Label: {args.label}")
    print(f"Samples: {len(samples)}")
    print(f"Recording ID: {recording_id}")

    if args.retrain:
        print()
        return run_retrain()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
