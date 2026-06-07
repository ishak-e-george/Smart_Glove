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

### 5-Finger Training Dataset

When the 5-finger calibration is stable, stop recalibrating and collect labeled rows.
Use only Arduino `status` and `snap` during collection.

The dedicated 5-finger dataset path is:

```text
data/raw/smart_glove_5f_dataset.csv
```

The Arduino row must contain exactly 15 numeric values:

```text
indexRaw,indexSmooth,indexPercent,middleRaw,middleSmooth,middlePercent,ringRaw,ringSmooth,ringPercent,pinkyRaw,pinkySmooth,pinkyPercent,thumbRaw,thumbSmooth,thumbPercent
```

Collect the initial 7 labels:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
python python/collect_5f_data.py --port COM4 --label OPEN --rows 200
python python/collect_5f_data.py --port COM4 --label INDEX_BENT --rows 200
python python/collect_5f_data.py --port COM4 --label MIDDLE_BENT --rows 200
python python/collect_5f_data.py --port COM4 --label RING_BENT --rows 200
python python/collect_5f_data.py --port COM4 --label PINKY_BENT --rows 200
python python/collect_5f_data.py --port COM4 --label THUMB_BENT --rows 200
python python/collect_5f_data.py --port COM4 --label FIST --rows 200
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

Train the dedicated 5-finger model:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
python python/train_5f_model.py
```

This writes:

```text
data/processed/smart_glove_5f_clean.csv
models/gesture_model_5f.joblib
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

Run 5-finger live prediction with phrase speech:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
python python/live_predict_5f.py --port COM4
```

For silent console-only testing:

```powershell
python python/live_predict_5f.py --port COM4 --no-speak
```

5-finger phrase mapping:

- `OPEN` -> `Hello`
- `INDEX_BENT` -> `Yes`
- `MIDDLE_BENT` -> `No`
- `RING_BENT` -> `Help`
- `PINKY_BENT` -> `Thank you`
- `THUMB_BENT` -> `I am okay`
- `FIST` -> `I need assistance`

### 3-Main-Finger Rescue Workflow

When pinky/thumb are too noisy, use the index/middle/ring-only workflow. The rescue firmware can stream 5 percent values, and the Python scripts save/train only the first three:

```text
indexPercent,middlePercent,ringPercent
```

Dataset:

```text
data/raw/smart_glove_3main_dataset.csv
```

Collect singles first:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
python python/collect_3main_data_burst.py --port COM4 --label REST --rows 150 --overwrite
python python/collect_3main_data_burst.py --port COM4 --label INDEX_BENT --rows 150
python python/collect_3main_data_burst.py --port COM4 --label MIDDLE_BENT --rows 150
python python/collect_3main_data_burst.py --port COM4 --label RING_BENT --rows 150
```

Then collect combinations:

```powershell
python python/collect_3main_data_burst.py --port COM4 --label INDEX_MIDDLE_BENT --rows 150
python python/collect_3main_data_burst.py --port COM4 --label INDEX_RING_BENT --rows 150
python python/collect_3main_data_burst.py --port COM4 --label MIDDLE_RING_BENT --rows 150
python python/collect_3main_data_burst.py --port COM4 --label ALL_THREE_BENT --rows 150
```

Train:

```powershell
python python/train_3main_model.py
```

Live one-shot demo:

```powershell
python python/live_predict_3main_oneshot.py --port COM4
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
