#!/usr/bin/env python3
"""
mobile_ws_bridge.py — WebSocket bridge for Smart Glove mobile app.

Connects your real Python AI pipeline to the Expo React Native mobile app
using WebSocket messages in the pipe-delimited format the app expects.

FORMAT SENT TO MOBILE APP:
    LABEL|Phrase|confidence|index,middle,ring,pinky,thumb
    e.g.  HELLO|Hello|0.93|100,0,0,0,0

This bridge has TWO modes:

  --mode demo   (default)
      Sends fake labels every 2 seconds so you can test the mobile app
      without needing the Arduino connected. Safe to run anytime.

  --mode live
      Reads real sensor data from the Arduino serial port, runs the
      5-finger RandomForest model, and sends real predictions to the app.
      Requires Arduino connected and glove_5word_model.joblib trained.

USAGE:
  # Demo mode (no Arduino needed):
  python python/mobile_ws_bridge.py

  # Live mode (Arduino on COM4):
  python python/mobile_ws_bridge.py --mode live --port COM4

MOBILE APP CONNECTION:
  Android emulator → ws://10.0.2.2:8765
  Physical phone   → ws://YOUR_LAPTOP_IP:8765  (e.g. ws://192.168.1.5:8765)
  The port matches --ws-port (default 8765).

DEPENDENCIES:
  pip install websockets fastapi uvicorn
  (live mode also needs: pyserial joblib scikit-learn pandas)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import threading
from pathlib import Path

try:
    import websockets
    from websockets.server import serve
except ImportError:
    print("Missing: pip install websockets")
    sys.exit(1)

# ── Connected mobile clients ──────────────────────────────────────────────────
connected_clients: set = set()


# ── Demo gesture table ────────────────────────────────────────────────────────
# These are sent in demo mode.  finger order: index,middle,ring,pinky,thumb
DEMO_GESTURES = [
    ("YES", "Yes", 0.97, [95, 85, 100, 100, 100]),
    ("WHERE", "Where?", 0.96, [55, 72, 100, 100, 100]),
    ("FEEL", "I feel", 0.95, [25, 65, 70, 100, 100]),
    ("NAME", "My name is...", 0.98, [20, 0, 100, 100, 100]),
    ("REST", "", 1.00, [0, 0, 0, 100, 100]),
]


def build_pipe_packet(label: str, phrase: str, confidence: float, fingers: list[int]) -> str:
    """Build the pipe-delimited packet the mobile app expects."""
    finger_str = ",".join(str(f) for f in fingers)
    return f"{label}|{phrase}|{confidence:.2f}|{finger_str}"


def build_gesture_message(label: str, confidence: float, fingers: list[int], state: str) -> str:
    return json.dumps({
        "type": "gesture_detected",
        "label": label,
        "confidence": round(confidence, 3),
        "state": state,
        "fingers": fingers,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


def build_state_message(state: str, label: str = "REST", fingers: list[int] | None = None) -> str:
    return json.dumps({
        "type": "system_state",
        "state": state,
        "label": label,
        "confidence": 1.0 if label == "REST" else None,
        "fingers": fingers or [],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


def values_by_feature(vals: list[int]) -> dict[str, int]:
    names = ["index", "middle", "ring", "pinky", "thumb"]
    return dict(zip(names, vals))


def is_rest(vals: list[int]) -> bool:
    data = values_by_feature(vals)
    index = data["index"]
    middle = data["middle"]
    ring = data["ring"]

    # The ring sensor can rest slightly bent even with no hand in the glove.
    # Treat ring-only drift as REST, while keeping NAME protected at ring >= 85.
    if index <= 35 and middle <= 35 and ring <= 60:
        return True

    # After FEEL, the middle sensor can stay high while index/ring are relaxed.
    # Treat that as REST drift; real FEEL still needs ring >= 55.
    if index <= 35 and ring <= 35 and middle <= 85:
        return True

    # Low/medium decay after a gesture should reset the demo instead of
    # keeping the state machine locked in "waiting for REST".
    if index <= 35 and middle < 55 and ring <= 60:
        return True

    return False


def passes_class_gate(label: str, vals: list[int]) -> bool:
    data = values_by_feature(vals)
    index = data["index"]
    middle = data["middle"]
    ring = data["ring"]

    if label == "REST":
        return is_rest(vals)
    if label == "FEEL":
        return index <= 35 and middle >= 55 and 55 <= ring <= 95
    if label == "NAME":
        return index <= 60 and middle <= 35 and ring >= 85
    if label == "WHERE":
        return middle >= 85 and ring >= 95
    if label == "YES":
        return index >= 80 and middle >= 75 and ring >= 85
    return False


# ── WebSocket server ──────────────────────────────────────────────────────────

async def ws_handler(websocket) -> None:
    connected_clients.add(websocket)
    addr = getattr(websocket, "remote_address", "unknown")
    print(f"[WS] Mobile client connected: {addr}")
    print(f"[WS] Total clients: {len(connected_clients)}")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] Mobile client disconnected: {addr}")
        print(f"[WS] Total clients: {len(connected_clients)}")


async def broadcast(packet: str) -> None:
    if not connected_clients:
        return
    dead = []
    for client in connected_clients:
        try:
            await client.send(packet)
        except Exception:
            dead.append(client)
    for c in dead:
        connected_clients.discard(c)


# ── Demo mode loop ────────────────────────────────────────────────────────────

async def demo_loop(interval: float) -> None:
    """Send fake gestures on a cycle so the mobile app can be tested."""
    print(f"\n[DEMO] Sending a fake gesture every {interval}s")
    print("[DEMO] Connect the mobile app and watch it display + speak each word\n")
    idx = 0
    # Send REST first
    rest = build_state_message("READY", "REST", [0, 0, 0, 100, 100])
    print(f"[TX] {rest}")
    await broadcast(rest)
    await asyncio.sleep(interval)

    while True:
        label, phrase, conf, fingers = DEMO_GESTURES[idx % len(DEMO_GESTURES)]
        # Skip REST in cycling (we already sent one)
        if label == "REST":
            idx += 1
            continue
        packet = build_gesture_message(label, conf, fingers, "WAITING_FOR_REST")
        print(f"[TX] {packet}")
        await broadcast(packet)
        await asyncio.sleep(interval)
        # Send REST between gestures so the app can reset
        rest_packet = build_state_message("READY", "REST", [0, 0, 0, 100, 100])
        print(f"[TX] {rest_packet}")
        await broadcast(rest_packet)
        await asyncio.sleep(1.0)
        idx += 1


# ── Live mode loop ────────────────────────────────────────────────────────────

def live_prediction_thread(args: argparse.Namespace, loop: asyncio.AbstractEventLoop) -> None:
    """
    Read real sensor data from Arduino, run the 5-finger word model,
    and push results to connected mobile clients.
    """
    try:
        import joblib
        import pandas as pd
        import serial
    except ImportError:
        print("[LIVE] Missing deps: pip install pyserial joblib scikit-learn pandas")
        return

    model_path = Path(args.model)
    if not model_path.exists():
        print(f"[LIVE] Model not found: {model_path}")
        print("[LIVE] Train with: python python/train_5finger_word_model.py")
        return

    artifact = joblib.load(model_path)
    model    = artifact["model"]
    features = artifact.get("features", ["index", "middle", "ring", "pinky", "thumb"])

    print(f"[LIVE] Model loaded: {model_path}")
    print(f"[LIVE] Features: {features}")
    print(f"[LIVE] Opening serial {args.port} @ {args.baud}...")

    from collections import deque, Counter
    history: deque[str]   = deque(maxlen=args.window)
    conf_history: deque[float] = deque(maxlen=args.window)
    armed      = False
    last_time  = 0.0
    min_votes  = args.min_votes
    min_conf   = args.confidence
    cooldown   = args.cooldown
    rest_frames = 0
    ready_sent = False
    debug_counter = 0
    raw_debug_counter = 0
    last_ready_time = 0.0
    last_mode_request = 0.0
    last_valid_csv = time.time()

    while True:
        try:
            import serial as _serial
            with _serial.Serial(args.port, args.baud, timeout=1) as ser:
                time.sleep(2.0)
                ser.reset_input_buffer()
                # Opening serial resets the Arduino, so CSV mode must be enabled
                # again after Python takes ownership of the COM port.
                ser.write(b"m\n")
                ser.flush()
                last_mode_request = time.time()
                last_valid_csv = time.time()
                time.sleep(0.5)
                print(f"[LIVE] Serial open. Waiting for gestures...")
                if args.debug:
                    print("[LIVE] Debug enabled. Showing sampled reads, predictions, REST, and gate decisions.")

                while True:
                    if ser.in_waiting > 1000:
                        if args.debug:
                            print(f"[DBG] serial backlog={ser.in_waiting}; clearing old buffered bytes")
                        ser.reset_input_buffer()
                    raw  = ser.readline().decode(errors="ignore").strip()
                    raw_debug_counter += 1
                    if args.debug and (raw_debug_counter <= 20 or raw_debug_counter % 25 == 0):
                        print(f"[RAW] {raw!r}")
                    if "Mode: STATUS" in raw or "STATUS" in raw:
                        if args.debug:
                            print("[DBG] Arduino reported STATUS mode; requesting CSV mode with 'm'")
                        ser.write(b"m\n")
                        ser.flush()
                        last_mode_request = time.time()
                        time.sleep(0.1)
                        continue
                    if not raw or raw.startswith("#"):
                        if args.debug and raw_debug_counter <= 20:
                            print("[DBG] skipped empty/comment line")
                        if not raw and time.time() - last_mode_request >= 2.0:
                            if args.debug:
                                print("[DBG] no serial data; requesting CSV mode with 'm'")
                            ser.write(b"m\n")
                            ser.flush()
                            last_mode_request = time.time()
                        if time.time() - last_valid_csv >= 20.0:
                            raise RuntimeError("no valid CSV received for 20 seconds")
                        continue
                    parts = raw.split(",")
                    if len(parts) < 5:
                        if args.debug and (raw_debug_counter <= 20 or raw_debug_counter % 25 == 0):
                            print(f"[DBG] skipped non-CSV line with {len(parts)} fields: {raw!r}")
                        continue
                    try:
                        vals = [max(0, min(100, int(float(p)))) for p in parts[:5]]
                    except ValueError:
                        if args.debug and (raw_debug_counter <= 20 or raw_debug_counter % 25 == 0):
                            print(f"[DBG] skipped unparsable CSV line: {raw!r}")
                        continue
                    last_valid_csv = time.time()

                    live_values = values_by_feature(vals)
                    selected_vals = [live_values[feature] for feature in features]
                    X = pd.DataFrame([selected_vals], columns=features)
                    pred = str(model.predict(X)[0])
                    confidence = 1.0
                    if hasattr(model, "predict_proba"):
                        probs = model.predict_proba(X)[0]
                        confidence = float(max(probs))

                    rest_detected = pred == "REST" or is_rest(vals)
                    debug_counter += 1
                    if args.debug and (debug_counter <= 20 or debug_counter % 25 == 0):
                        print(f"[DBG] vals={vals} selected={selected_vals} pred={pred} conf={confidence:.2f} rest={rest_detected}")
                    if rest_detected:
                        rest_frames += 1
                        history.clear()
                        conf_history.clear()
                        if args.debug and debug_counter % 10 == 0:
                            print(f"[DBG] REST frames={rest_frames}/{args.rest_frames} vals={vals} pred={pred} conf={confidence:.2f}")
                        if rest_frames >= args.rest_frames:
                            armed = True
                            if not ready_sent:
                                rest_packet = build_state_message("READY", "REST", vals)
                                print(f"[TX] {rest_packet}")
                                asyncio.run_coroutine_threadsafe(broadcast(rest_packet), loop)
                                ready_sent = True
                                last_ready_time = time.time()
                        continue

                    rest_frames = 0

                    if not armed:
                        if args.debug and debug_counter % 10 == 0:
                            print(f"[DBG] waiting_for_rest vals={vals} pred={pred} conf={confidence:.2f}")
                        continue

                    if (time.time() - last_ready_time) < args.post_rest_delay:
                        if args.debug and debug_counter % 10 == 0:
                            remaining = args.post_rest_delay - (time.time() - last_ready_time)
                            print(f"[DBG] post_rest_delay {remaining:.2f}s vals={vals} pred={pred} conf={confidence:.2f}")
                        continue

                    history.append(pred)
                    conf_history.append(confidence)
                    counts = Counter(history)
                    label, votes = counts.most_common(1)[0]
                    avg_conf = sum(conf_history) / len(conf_history)
                    gate_ok = passes_class_gate(label, vals)

                    if args.debug and debug_counter % 5 == 0:
                        print(
                            f"[DBG] vote_frame vals={vals} pred={pred} label={label} "
                            f"votes={votes}/{min_votes} avg_conf={avg_conf:.2f} gate={gate_ok}"
                        )

                    now = time.time()
                    if (
                        label != "REST"
                        and votes >= min_votes
                        and avg_conf >= min_conf
                        and gate_ok
                        and (now - last_time) >= cooldown
                    ):
                        packet = build_gesture_message(label, avg_conf, vals, "WAITING_FOR_REST")
                        print(f"[TX] {packet}")
                        asyncio.run_coroutine_threadsafe(broadcast(packet), loop)
                        last_time = now
                        armed = False
                        ready_sent = False
                        history.clear()
                        conf_history.clear()

        except Exception as e:
            print(f"[LIVE] Error: {e} — retrying in 3s...")
            time.sleep(3)


# ── Main ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smart Glove WebSocket bridge for mobile app",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--mode",       default="demo", choices=["demo", "live"],
                        help="demo = fake labels every N seconds | live = real Arduino AI")
    parser.add_argument("--port",       default="COM4",
                        help="Arduino serial port (live mode only), e.g. COM4")
    parser.add_argument("--baud",       type=int, default=115200)
    parser.add_argument("--model",      default=str(Path(__file__).resolve().parents[1] / "models" / "asl_3finger_model.joblib"),
                        help="Path to trained .joblib model (live mode only)")
    parser.add_argument("--ws-host",    default="0.0.0.0",
                        help="WebSocket host (0.0.0.0 = accept all interfaces)")
    parser.add_argument("--ws-port",    type=int, default=8765,
                        help="WebSocket port (default 8765)")
    parser.add_argument("--interval",   type=float, default=2.5,
                        help="Seconds between fake gestures in demo mode")
    # Live mode tuning
    parser.add_argument("--window",     type=int,   default=7,
                        help="Size of prediction rolling window (~0.5 seconds at 60ms loop)")
    parser.add_argument("--min-votes",  type=int,   default=5,
                        help="Number of matching votes required to confirm gesture")
    parser.add_argument("--confidence", type=float, default=0.60)
    parser.add_argument("--rest-max",   type=int,   default=45,
                        help="Max finger percentage to qualify as REST/open hand")
    parser.add_argument("--rest-frames", type=int, default=6,
                        help="Consecutive REST frames required before accepting a new gesture")
    parser.add_argument("--cooldown",   type=float, default=1.0,
                        help="Speech cooldown in seconds")
    parser.add_argument("--post-rest-delay", type=float, default=0.7,
                        help="Seconds to ignore transition frames after stable REST is detected")
    parser.add_argument("--debug", action="store_true",
                        help="Print sampled live serial values, predictions, and gate decisions")
    return parser.parse_args()


async def run(args: argparse.Namespace) -> None:
    loop = asyncio.get_running_loop()

    print("=" * 55)
    print("  Smart Glove WebSocket Bridge")
    print(f"  Mode    : {args.mode.upper()}")
    print(f"  Address : ws://0.0.0.0:{args.ws_port}")
    print(f"  Android emulator: ws://10.0.2.2:{args.ws_port}")
    print(f"  Physical phone  : ws://<YOUR_PC_IP>:{args.ws_port}")
    print("=" * 55)
    print()

    if args.mode == "live":
        t = threading.Thread(
            target=live_prediction_thread,
            args=(args, loop),
            daemon=True,
        )
        t.start()
        async with serve(ws_handler, args.ws_host, args.ws_port):
            await asyncio.Future()   # run forever
    else:
        async with serve(ws_handler, args.ws_host, args.ws_port):
            await demo_loop(args.interval)


def main() -> int:
    args = parse_args()
    try:
        asyncio.run(run(args))
        return 0
    except KeyboardInterrupt:
        print("\n[Bridge] Stopped.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
