# Smart Glove AI

This folder isolates the first ML gesture pipeline from the rest of the project.

Current scope:

- ML pipeline currently uses 2 fingers only: index and middle
- Calibration firmware now supports all 5 fingers individually
- Python pipeline supports feature sets `2`, `3`, and `5`
- Serial data first, not BLE
- Random Forest classifier first
- Small vocabulary first
- No LLM dependency in this stage

## Folder Layout

```text
smart-glove-ai/
  arduino/
    glove_sensor_reader.ino
  data/
    gesture_dataset.csv
  models/
    gesture_model.joblib
  python/
    collect_data.py
    train_model.py
    live_predict.py
    ws_predict.py
    speak.py
    common.py
    requirements.txt
```

## Hardware Stage

Recommended wiring for each flex sensor:

```text
3.3V -> Flex Sensor -> A0/A1 -> 22k resistor -> GND
```

Suggested pins:

- `A0` = Index
- `A1` = Middle

Optional smoothing capacitor:

```text
A0 -> 0.1uF capacitor -> GND
A1 -> 0.1uF capacitor -> GND
```

Target hardware quality:

- Index range at least `120`
- Middle range at least `120`
- Noise while still roughly `<= 10-20` ADC points

## Arduino Stage

Upload [glove_sensor_reader.ino](/C:/Users/HP/Desktop/New%20Fyp-V1/smart-glove-ai/arduino/glove_sensor_reader.ino).

The sketch:

- reads `A0` to `A4`
- applies moving-average smoothing
- stores flat and curl calibration points per finger
- saves calibration in board flash
- restores calibration after reboot
- keeps streaming the same 2-finger CSV lines for the current Python model

Serial command flow:

- `n1` to `n5`: set how many fingers are physically connected right now
- `f1` to `f5`: save flat for one finger
- `c1` to `c5`: save curl for one finger
- `r1` to `r5`: reset one finger
- `fa`: save flat for all fingers
- `ca`: save curl for all fingers
- `r`: reset all fingers
- `h`: print all saved calibration

Calibration behavior:

- all per-finger calibration commands save into board flash
- calibration is restored automatically after reboot or power cycle
- use `r` only when you want to clear and recalibrate

Finger numbers:

- `1` = Index
- `2` = Middle
- `3` = Ring
- `4` = Pinky
- `5` = Thumb

Recommended setup examples:

- only index + middle connected: send `n2`
- index + middle + ring connected: send `n3`
- all five connected: send `n5`

The active finger count is saved in flash together with calibration.

Output format:

```text
indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent
```

## Python Setup

Install dependencies:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai\python"
pip install -r requirements.txt
```

## Dataset Collection

Check sensor quality before collecting data:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
.\.venv\Scripts\python.exe .\python\check_sensor_quality.py --port COM4 --seconds 10
```

Start with these labels:

- `REST`
- `INDEX_BENT`
- `MIDDLE_BENT`
- `BOTH_BENT`
- `INDEX_HALF`

Collect 100 rows per gesture:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai\python"
python collect_data.py --port COM5 --label REST --samples 100
python collect_data.py --port COM5 --label INDEX_BENT --samples 100
python collect_data.py --port COM5 --label MIDDLE_BENT --samples 100
python collect_data.py --port COM5 --label BOTH_BENT --samples 100
python collect_data.py --port COM5 --label INDEX_HALF --samples 100
```

If you later expand the firmware stream to 5-finger CSV, use a separate dataset file:

```powershell
python collect_data.py --port COM5 --label REST --samples 100 --feature-set 5 --csv ..\data\gesture_dataset_5f.csv
```

For a 3-finger stream:

```powershell
python collect_data.py --port COM5 --feature-set 3 --label REST --samples 150 --csv ..\data\gesture_dataset_3f.csv
```

While recording, vary:

- finger pressure
- hand angle
- bend speed
- bend depth

## Training

Train the first classifier:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai\python"
python train_model.py
```

For a future 5-finger dataset:

```powershell
python train_model.py --feature-set 5 --csv ..\data\gesture_dataset_5f.csv --model-out ..\models\gesture_model_5f.joblib
```

For a 3-finger dataset:

```powershell
python train_model.py --feature-set 3 --csv ..\data\gesture_dataset_3f.csv --model-out ..\models\gesture_model_3f.joblib
```

Initial target:

- acceptable: `>= 85%` accuracy
- strong first version: `>= 90%`

More important than raw accuracy:

- check the confusion matrix
- watch whether `INDEX_HALF` is confused with `INDEX_BENT`

## Live Prediction

Run live prediction after training:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai\python"
python live_predict.py --port COM5
```

Default word mapping:

- `INDEX_BENT` -> `Yes`
- `MIDDLE_BENT` -> `No`
- `BOTH_BENT` -> `Help`
- `INDEX_HALF` -> `Water`
- `REST` -> no output

The script requires a stable gesture for `0.8` seconds before accepting it.

Rule-based sentence mode:

```powershell
python live_predict.py --port COM5 --build-sentence
```

Speech mode:

```powershell
python live_predict.py --port COM5 --speak
python live_predict.py --port COM5 --build-sentence --speak
```

## WebSocket Browser Output

Install dependencies into the project virtual environment:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
.\.venv\Scripts\python.exe -m pip install -r .\python\requirements.txt
```

Run the WebSocket predictor after `gesture_model.joblib` exists:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
.\.venv\Scripts\python.exe .\python\ws_predict.py --port COM4
```

Expected startup logs:

```text
Starting WebSocket server on ws://127.0.0.1:8765
Opening COM4 at 115200 baud
Using model: ...\gesture_model.joblib
Hold threshold: 0.80s
Cooldown: 1.50s
```

The browser-side speech panel is built into [serial-visualizer-react-3d/app.js](/C:/Users/HP/Desktop/New%20Fyp-V1/serial-visualizer-react-3d/app.js:1).
Open `http://127.0.0.1:8080`, wait for the WebSocket status to turn connected, then click `Enable Laptop Voice`.

## Recommended Phase Order

1. Use `22k` resistors.
2. Recalibrate index and middle.
3. Verify stable CSV serial output.
4. Collect at least `100` samples per gesture.
5. Train `RandomForestClassifier`.
6. Test live prediction.
7. Map predictions to words.
8. Add hold timer.
9. Add speech.
10. Add LLM sentence generation only after the classifier is working.
