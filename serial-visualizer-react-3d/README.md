# Smart Glove React 3D Visualizer

This version uses React plus a simple Three.js finger model in the browser.

## Files

- `index.html`: import map and root container
- `app.js`: React app, Web Serial parser, and 3D scene
- `styles.css`: layout and styling

## Run

1. Plug in the Arduino Nano 33 BLE Rev2.
2. Upload [`../firmware/smart_glove_serial_calibration_visualizer.ino`](C:\Users\HP\Desktop\New Fyp-V1\firmware\smart_glove_serial_calibration_visualizer.ino).
3. From this folder, start a local server:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\serial-visualizer-react-3d"
python -m http.server 8080
```

4. Open `http://localhost:8080` in Chrome or Edge.
5. Click `Connect Serial` and choose the Arduino COM port.

## Browser Speech Panel

This frontend now also listens for accepted gesture predictions over WebSocket.

1. Train a model under `smart-glove-ai/models/gesture_model.joblib`.
2. Start the predictor:

```powershell
cd "C:\Users\HP\Desktop\New Fyp-V1\smart-glove-ai"
.\.venv\Scripts\python.exe .\python\ws_predict.py --port COM4
```

3. Open `http://127.0.0.1:8080`.
4. In the `Gesture Speech` panel, wait for `WebSocket: Connected`.
5. Click `Enable Laptop Voice` once so the browser can speak accepted words.

## Notes

- This page loads React and React Three Fiber from CDN import maps, so the laptop needs internet access the first time.
- Web Serial works on `localhost`, not by opening the file directly.
- The parser accepts both the compact `VIS,...` lines and the original dashboard lines.
