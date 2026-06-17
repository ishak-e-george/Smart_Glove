# Smart Glove AI

This folder contains the active hardware and Python AI pipeline for the Smart Glove mobile app.

## Active Files

```text
arduino/glove_sensor_reader/glove_sensor_reader.ino       Main 5-finger calibrated serial firmware
arduino/fake_ble_label_sender/fake_ble_label_sender.ino   BLE label sender sketch
python/collect_asl_alphabet_data.py                       Serial data collection
python/train_asl_alphabet_model.py                        Random Forest training
python/mobile_ws_bridge.py                                Live WebSocket bridge for the mobile app
python/common.py                                          Shared CSV helpers
python/requirements.txt                                   Python dependencies
collect_abcl_dual_dataset.ps1                             Dual-glove A/B/C/L collection helper
data/external/asl_alphabet/                               Current ASL alphabet datasets
models/                                                   Current trained models
```

## Install

```powershell
cd smart-glove-ai
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\python\requirements.txt
```

## Collect Data

Upload `arduino/glove_sensor_reader/glove_sensor_reader.ino`, calibrate each finger, then collect rows:

```powershell
.\.venv\Scripts\python.exe .\python\collect_asl_alphabet_data.py --port COM4 --label A --rows 100
```

Default dataset:

```text
data/external/asl_alphabet/asl_alphabet_5finger.csv
```

## Train

```powershell
.\.venv\Scripts\python.exe .\python\train_asl_alphabet_model.py --data data\external\asl_alphabet\asl_alphabet_5finger.csv --model-out models\asl_alphabet_5finger_model.joblib
```

## Stream To Mobile

Single glove:

```powershell
.\.venv\Scripts\python.exe .\python\mobile_ws_bridge.py --mode live --port COM4 --model .\models\asl_alphabet_5finger_model.joblib --label-mode alphabet
```

Two gloves:

```powershell
.\.venv\Scripts\python.exe .\python\mobile_ws_bridge.py --mode live-dual --left-port COM4 --right-port COM5 --left-model .\models\asl_left_alphabet_model.joblib --right-model .\models\asl_right_alphabet_model.joblib --label-mode alphabet
```

The mobile app should connect to `ws://10.0.2.2:8765` on Android emulator or `ws://<YOUR_LAPTOP_IP>:8765` on a physical phone.
