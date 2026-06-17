# Smart Glove ASL Translator

Smart Glove is a final-year project that turns flex-sensor hand gestures into spoken ASL-oriented output. The cleaned repository now keeps only the active live path: an Expo React Native mobile app, Arduino glove firmware, Python serial/WebSocket AI bridge, current ASL alphabet data, and trained model artifacts.

## What The System Does

- Reads calibrated flex-sensor percentages from an Arduino Nano 33 BLE Rev2.
- Runs a trained scikit-learn Random Forest classifier in Python.
- Streams accepted gesture labels to the mobile app over WebSocket.
- Supports one-glove and two-glove live modes.
- Lets each mobile user choose default ASL phrases, alphabet output, both-hands output, or custom personal phrases.
- Speaks translated output on the phone using `expo-speech`.
- Stores local app settings, profiles, phrases, and output history in SQLite.

## Active Architecture

```text
Arduino glove firmware
  -> serial CSV stream
  -> Python WebSocket bridge + trained model
  -> Expo React Native app
  -> local profile lookup, speech output, and history
```

There is no active backend service in the cleaned project. Old server, capture, image, and document assets were removed because they are not required by the current runtime.

## Repository Layout

```text
mobile-app/                         Expo React Native app
mobile-app/src/screens/             Login, mode selection, BLE, WebSocket, profiles, history, settings
mobile-app/src/services/            Local SQLite, speech, WebSocket parsing, profile services
mobile-app/src/constants/           Default ASL, alphabet, both-hands, and custom phrase profiles
smart-glove-ai/arduino/             Current Arduino sketches
smart-glove-ai/python/              Collection, training, test, and live bridge scripts
smart-glove-ai/data/external/       Current ASL alphabet CSV data
smart-glove-ai/models/              Current trained model artifacts
```

## Mobile App Setup

```powershell
cd mobile-app
npm install
npx expo start
```

Useful app flows:

- `Login` creates or resumes a local user session.
- `Choose Communication Mode` selects the phrase profile and speech language.
- `WebSocket Live Mode` receives labels from the Python bridge.
- `BLE Label Mode` receives labels directly from Arduino BLE firmware.
- `Phrase Editor` customizes spoken phrases.
- `ASL History` shows accepted outputs.
- `ASL Settings` changes the WebSocket URL, speech settings, and debug options.

For Android emulator WebSocket testing, use:

```text
ws://10.0.2.2:8765
```

For a physical phone, use the laptop IP address:

```text
ws://<YOUR_LAPTOP_IP>:8765
```

## Python Setup

Create and activate a Python environment, then install the live bridge and training dependencies:

```powershell
cd smart-glove-ai
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\python\requirements.txt
```

The Python stack uses:

- `pandas`
- `scikit-learn`
- `joblib`
- `pyserial`
- `websockets`
- `pyttsx3`

## Arduino Firmware

Current firmware lives in:

```text
smart-glove-ai/arduino/glove_sensor_reader/glove_sensor_reader.ino
smart-glove-ai/arduino/fake_ble_label_sender/fake_ble_label_sender.ino
```

The main glove reader streams five normalized values:

```text
index,middle,ring,pinky,thumb
```

Calibration commands:

```text
f or fa   save flat calibration for all fingers
c or ca   save curl calibration for all fingers
f1..f5    save flat calibration for one finger
c1..c5    save curl calibration for one finger
r1..r5    reset one finger
r or ra   reset all calibration
s         save calibration to flash
l         load calibration from flash
p         print calibration status
h         print help/status
```

Finger mapping:

```text
1 = index
2 = middle
3 = ring
4 = pinky
5 = thumb
```

## Data Collection

Collect ASL alphabet rows from the Arduino serial stream:

```powershell
cd smart-glove-ai
.\.venv\Scripts\python.exe .\python\collect_asl_alphabet_data.py --port COM4 --label A --rows 100
```

Default output:

```text
smart-glove-ai/data/external/asl_alphabet/asl_alphabet_5finger.csv
```

The CSV columns are:

```text
label,index,middle,ring,pinky,thumb
```

## Model Training

Train the current ASL alphabet classifier:

```powershell
cd smart-glove-ai
.\.venv\Scripts\python.exe .\python\train_asl_alphabet_model.py --data data\external\asl_alphabet\asl_alphabet_5finger.csv --model-out models\asl_alphabet_5finger_model.joblib
```

Current model artifacts kept in the repository:

```text
smart-glove-ai/models/asl_alphabet_5finger_model.joblib
smart-glove-ai/models/asl_left_alphabet_model.joblib
smart-glove-ai/models/asl_right_alphabet_model.joblib
```

## Live Bridge

Single glove:

```powershell
cd smart-glove-ai
.\.venv\Scripts\python.exe .\python\mobile_ws_bridge.py --mode live --port COM4 --model .\models\asl_alphabet_5finger_model.joblib --label-mode alphabet
```

Two gloves:

```powershell
cd smart-glove-ai
.\.venv\Scripts\python.exe .\python\mobile_ws_bridge.py --mode live-dual --left-port COM4 --right-port COM5 --left-model .\models\asl_left_alphabet_model.joblib --right-model .\models\asl_right_alphabet_model.joblib --label-mode alphabet
```

Default WebSocket server:

```text
ws://0.0.0.0:8765
```

## Verification

Mobile TypeScript:

```powershell
cd mobile-app
npx tsc --noEmit
```

Python syntax:

```powershell
cd smart-glove-ai
.\.venv\Scripts\python.exe -m py_compile .\python\mobile_ws_bridge.py .\python\collect_asl_alphabet_data.py .\python\train_asl_alphabet_model.py
```

Arduino verification is done from the Arduino IDE by compiling and uploading the sketches under `smart-glove-ai/arduino/`.

## Notes For Development

- Keep generated documents, screenshots, local-only assets, and backup datasets out of Git.
- Add new gesture data under `smart-glove-ai/data/external/` only when it is part of the active training set.
- Add new models under `smart-glove-ai/models/` only when the app or bridge is configured to use them.
- Keep the mobile app backend-free unless a real server is reintroduced intentionally.
