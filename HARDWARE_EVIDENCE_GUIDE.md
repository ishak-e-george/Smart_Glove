# Smart Glove Hardware + ML Evidence Guide

Use this file to collect report-ready proof that the hardware data is connected to the software ML pipeline.

## 1. App Screenshots

Capture these screens in order:

1. `01-recordings-hardware.png`
   - Screen: `Devices Dashboard -> Recordings`
   - Must show:
     - `Hardware (3)`
     - `Recording #9 REST`
     - `Recording #10 INDEX_BENT`
     - `Recording #11 MIDDLE_BENT`
     - `Source: Hardware serial`

2. `02-training-export.png`
   - Screen: `Recordings`
   - Must show:
     - total recordings
     - total rows
     - label counts for `REST`, `INDEX_BENT`, and `MIDDLE_BENT`

3. `03-model-status.png`
   - Screen: `Devices Dashboard -> Model Status`
   - Must show:
     - ready labels: `REST`, `INDEX_BENT`, `MIDDLE_BENT`
     - dataset row counts

4. `04-model-evaluation.png`
   - Screen: `Model Status`
   - Must show:
     - accuracy
     - test rows
     - confusion matrix

5. `05-phrase-output.png`
   - Screen: `Software Capture -> Phrase Output`
   - Must show:
     - recognized gesture `INDEX_BENT`
     - phrase `Yes`

## 2. Hardware Data Quality Check

Run:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"
python -m app.scripts.validate_hardware_samples
```

Current proof target:

```text
REST: indexPercent 0-20, middlePercent 0-20
INDEX_BENT: indexPercent 60-100, middlePercent 0-20
MIDDLE_BENT: indexPercent 0-20, middlePercent 60-100
BOTH_BENT: indexPercent 60-100, middlePercent 60-100
INDEX_HALF: indexPercent 25-59, middlePercent 0-20
```

For final quality, collect at least:

```text
REST: 30 clean rows
INDEX_BENT: 30 clean rows
MIDDLE_BENT: 30 clean rows
BOTH_BENT: 30 clean rows
INDEX_HALF: 30 clean rows
```

## 3. Import and Retrain Commands

After adding more real rows to the sample files, run:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\backend"

python -m app.scripts.import_serial_capture --label REST --file hardware_samples/rest.txt
python -m app.scripts.import_serial_capture --label INDEX_BENT --file hardware_samples/index_bent.txt
python -m app.scripts.import_serial_capture --label MIDDLE_BENT --file hardware_samples/middle_bent.txt --retrain
```

When the two extra labels are ready, use:

```powershell
python -m app.scripts.import_serial_capture --label BOTH_BENT --file hardware_samples/both_bent.txt
python -m app.scripts.import_serial_capture --label INDEX_HALF --file hardware_samples/index_half.txt --retrain
```

Then verify:

```powershell
python -m app.scripts.validate_hardware_samples
python -m pytest
```

## 4. Report Statement

Use this wording:

> The Smart Glove platform supports a complete ML workflow. Real Arduino flex-sensor samples were captured through Serial Monitor, imported into backend recordings, exported as training rows, used to retrain the RandomForest gesture model, and verified in the mobile interface through Recordings, Model Status, Evaluation, and Phrase Output screens.
