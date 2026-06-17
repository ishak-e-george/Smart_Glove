# ASL Alphabet Glove Dataset

Place the normalized ASL alphabet flex-sensor CSV here:

```csv
label,index,middle,ring,pinky,thumb
A,90,80,75,70,65
B,0,0,0,0,80
```

Required labels:

```text
A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
```

Optional label:

```text
REST
```

Train the alphabet model from the repository root:

```powershell
python smart-glove-ai/python/train_asl_alphabet_model.py --data smart-glove-ai/data/external/asl_alphabet/asl_alphabet_5finger.csv --model-out smart-glove-ai/models/asl_alphabet_5finger_model.joblib
```

Run the bridge with the alphabet model:

```powershell
python smart-glove-ai/python/mobile_ws_bridge.py --mode live --port COM4 --model smart-glove-ai/models/asl_alphabet_5finger_model.joblib --label-mode alphabet --debug
```

Notes:

- The app now has an `ASL Alphabet Mode` profile.
- The WebSocket parser accepts `A-Z` labels.
- `J` and `Z` are motion letters in real ASL, so they need time-series handling or very consistent collection.
