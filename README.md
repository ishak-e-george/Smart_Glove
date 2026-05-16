# Smart Glove AI Translation Platform

This project is a smart-glove software platform for converting flex-sensor gesture recordings into phrase output.

The current completed path is software-first:

```text
Mobile app
  -> software or BLE capture
  -> backend recording upload
  -> scikit-learn gesture prediction
  -> phrase lookup
  -> prediction history
  -> recordings view
  -> training export
```

Hardware streaming exists separately, but the stable project workflow does not depend on live hardware.

## Current Capabilities

- User login with JWT authentication.
- Device registration and device list.
- Software capture using trained 2-finger sample profiles.
- JSON recording upload to the backend.
- Real ML prediction from uploaded recordings.
- Phrase output screen with prediction confidence.
- Prediction history.
- Recording/data screen.
- Model and dataset status screen.
- Training export from uploaded recordings.
- Backend automated tests.
- Mobile TypeScript validation.

## AI Model

The project uses supervised machine learning, not an LLM.

- Algorithm: Random Forest classifier.
- Library: scikit-learn.
- Model artifact: `smart-glove-ai/models/gesture_model.joblib`.
- Training script: `smart-glove-ai/python/train_model.py`.
- Dataset CSV: `smart-glove-ai/data/gesture_dataset.csv`.
- Feature set: 2-finger flex sensor features.

Current trained labels:

- `REST`
- `INDEX_BENT`
- `MIDDLE_BENT`

Pending labels that need real data collection and retraining:

- `BOTH_BENT` -> Help
- `INDEX_HALF` -> Water

## Database

The backend uses:

- FastAPI for the API.
- SQLAlchemy for ORM.
- Alembic for migrations.
- PostgreSQL as the configured development database target.
- SQLite in-memory database for tests.

The database URL is controlled by `DATABASE_URL`. If it is not set, the backend defaults to:

```text
postgresql://postgres:postgres@localhost:5432/smart_glove
```

## Project Structure

```text
backend/                    FastAPI backend, database models, tests
mobile-app/                 Expo React Native mobile app
smart-glove-ai/             ML training, live prediction, model artifacts
firmware/                   Arduino sketches
serial-visualizer/          Browser serial visualizer
serial-visualizer-react-3d/ React/Three.js visualizer with WebSocket speech
assets/                     Mock recordings and processed assets
```

## Backend Setup

From the backend folder:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

API docs:

```text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/redoc
```

Seed demo users, gestures, and phrases:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
python -m app.scripts.seed_demo_data
```

Bootstrap a complete software demo state with user, gestures, phrases, demo device, recordings, and predictions:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
python -m app.scripts.bootstrap_demo_workflow
```

Default seeded login:

```text
user@glove.com / password123
researcher@glove.com / password123
```

## Mobile Setup

From the mobile app folder:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\mobile-app"
npm install
npx expo start --localhost --port 8081
```

The mobile API base URL is currently:

```text
http://localhost:8000/api/v1
```

For a physical phone, update `mobile-app/src/api/client.ts` to use the laptop IP address instead of `localhost`.

## Software Workflow

1. Run the backend.
2. Seed demo data.
3. Run the mobile app.
4. Log in as `user@glove.com`.
5. Register or select a device.
6. Choose **Model Smoke Test / Software Capture**.
7. Select a trained gesture.
8. Upload and predict.
9. View phrase output.
10. Check History.
11. Check Data / Recordings.
12. Export training data.
13. Check Model Status.

## Important API Endpoints

Base URL:

```text
http://localhost:8000/api/v1
```

Core endpoints:

- `POST /auth/login`
- `GET /devices/`
- `POST /devices/`
- `POST /recordings/upload-json`
- `GET /recordings/`
- `POST /predictions/from-recording/{recording_id}`
- `GET /predictions/`
- `GET /phrases/by-gesture/{gesture_id}`
- `GET /datasets/status/model`
- `GET /datasets/export/recordings`

## Verification

Backend tests:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
$env:PYTHONPATH='.'
python -m pytest
```

Mobile TypeScript:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\mobile-app"
cmd /c npx tsc --noEmit
```

Current expected status:

```text
Backend tests: passing
Mobile TypeScript: passing
```

## Hardware Status

The project includes Arduino firmware, BLE service code, serial prediction scripts, and a browser/WebSocket speech visualizer.

For now, hardware is not the critical path. The software platform is complete enough to:

- ingest sensor-shaped recordings,
- classify trained gestures,
- translate to phrases,
- store prediction history,
- export recordings for model training.

The next hardware milestone is collecting real samples for:

- `BOTH_BENT`
- `INDEX_HALF`

Then retrain the model and update the software capture options.

## Known Limitations

- The current trained model only supports three labels.
- Backend ML dependencies must be installed for model artifact metadata and inference.
- Mobile physical-device testing requires changing the API base URL from `localhost` to the laptop IP.
- Live BLE capture still needs hardware calibration and real-device testing.
- Training export currently returns a structured export summary and preview, not a downloaded CSV file.

## Recommended Next Steps

1. Collect real data for `BOTH_BENT` and `INDEX_HALF`.
2. Retrain the Random Forest model.
3. Update software capture options to include the new trained labels.
4. Add downloadable CSV export if needed.
5. Complete BLE hardware calibration and live capture testing.
