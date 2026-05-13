# Smart Glove Serial Visualizer

This page connects to the Arduino over USB serial and animates the 3-finger glove in real time.

## What it supports

- Your current calibration sketch output, for example lines like:
  `INDEX | RAW=... | SMOOTH=... | ... | PERCENT=... | STATE=...`
- A cleaner compact telemetry line that starts with `VIS,`

## Run it

1. Plug in the Arduino Nano 33 BLE Rev2.
2. Upload the sketch in [`../firmware/smart_glove_serial_calibration_visualizer.ino`](C:\Users\HP\Desktop\New Fyp-V1\firmware\smart_glove_serial_calibration_visualizer.ino).
3. Start a local static server from this folder:

```powershell
python -m http.server 8080
```

4. Open `http://localhost:8080` in Chrome or Edge.
5. Click `Connect Serial` and choose the Arduino COM port.

## Notes

- Web Serial requires a secure context. `localhost` works. Opening the HTML file directly usually will not.
- If you keep your original sketch, the page still works, but the compact `VIS,` line gives cleaner parsing.
