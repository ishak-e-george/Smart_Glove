# Smart Glove Mobile Emulator Guide

## 1. Start Backend

From the project root:

```powershell
cd backend
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

## 2. Start Android Emulator

Open Android Studio, then start an Android Virtual Device from Device Manager.

## 3. Start Expo On Android

From the project root:

```powershell
cd mobile-app
npx expo start --android
```

Login:

```text
Email: user@glove.com
Password: password123
```

## 4. What Works In The Emulator

- Login
- Devices dashboard
- Software capture
- Phrase output
- Prediction history
- Recordings/data screen
- Model status and evaluation
- 3D speech demo screen

## 5. Hardware Limits

The Android emulator cannot read the Arduino USB Serial stream directly.

Live BLE requires a native Expo dev build or APK because Expo Go does not include the `react-native-ble-plx` native module.

For the presentation, use:

- Android emulator for the actual mobile app workflow
- Chrome/Edge web app for live USB Arduino serial demo
- Backend retraining script for ML lifecycle evidence
