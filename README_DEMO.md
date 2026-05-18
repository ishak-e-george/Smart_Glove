# Smart Glove AI Demo Guide

## 1. Start Backend

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Check:

```text
http://127.0.0.1:8000/api/v1/
```

Expected:

```json
{"status":"ok"}
```

## 2. Start Frontend

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\mobile-app"
npx expo start --web --localhost --port 8081
```

Open:

```text
http://localhost:8081
```

## 3. Login

```text
Email: user@glove.com
Password: password123
```

## 4. Demo Flow

Run this path:

```text
Login
-> Devices Dashboard
-> Software Capture
-> Select REST
-> Capture
-> Phrase Output
-> History
-> Data / Recordings
-> Training Export
-> Model Status
-> Evaluation
```

Repeat Software Capture for:

```text
INDEX_BENT
MIDDLE_BENT
```

## 5. Supported Gestures

Current trained model supports:

- `REST` -> Silent baseline
- `INDEX_BENT` -> Yes
- `MIDDLE_BENT` -> No

## 6. Pending Gestures

Planned gestures that need more real data before training:

- `BOTH_BENT` -> Help
- `INDEX_HALF` -> Water

## 7. AI Lifecycle

The current software pipeline supports:

```text
Capture
-> Store recording
-> Predict gesture
-> Translate phrase
-> Track history
-> Export training data
-> Retrain model
-> Evaluate model
```

Retrain from uploaded recordings:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
python -m app.scripts.retrain_from_recordings
```

CSV export endpoint:

```text
http://127.0.0.1:8000/api/v1/datasets/export/recordings.csv
```

## 8. Hardware Proof

For hardware evidence, show Arduino serial readings in this feature format:

```text
indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent
```

Example:

```text
1780,1765,10,1900,1890,5
1650,1665,70,1905,1898,7
1785,1770,12,1800,1810,68
```

## 9. Current Limitations

- Hardware live capture still needs calibration.
- BLE mobile build needs native/custom build support.
- More real samples are needed for `BOTH_BENT` and `INDEX_HALF`.
- Current model supports the three trained labels listed above.

## 10. Final Verification

Backend tests:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
pytest
```

Mobile TypeScript:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\mobile-app"
cmd /c npx tsc --noEmit
```
