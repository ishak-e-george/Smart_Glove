#!/usr/bin/env python3
"""
mobile_ws_bridge.py — WebSocket bridge for Smart Glove mobile app.

Connects your real Python AI pipeline to the Expo React Native mobile app
using WebSocket messages in the pipe-delimited format the app expects.

FORMAT SENT TO MOBILE APP:
    LABEL|Phrase|confidence|index,middle,ring,pinky,thumb
    e.g.  HELLO|Hello|0.93|100,0,0,0,0

This bridge has two live modes:

  --mode live
      Reads real sensor data from the Arduino serial port, runs the
      trained RandomForest model, and sends real predictions to the app.

  --mode live-dual
      Reads two Arduino serial ports, runs one model per glove, and sends
      paired left/right predictions to the app.

USAGE:
  python python/mobile_ws_bridge.py --mode live --port COM4
  python python/mobile_ws_bridge.py --mode live-dual --left-port COM4 --right-port COM5

MOBILE APP CONNECTION:
  Android emulator → ws://10.0.2.2:8765
  Physical phone   → ws://YOUR_LAPTOP_IP:8765  (e.g. ws://192.168.1.5:8765)
  The port matches --ws-port (default 8765).

DEPENDENCIES:
  pip install websockets pyserial joblib scikit-learn pandas
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


ASL_ALPHABET_LABELS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


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


def build_dual_gesture_message(
    left_label: str,
    right_label: str,
    left_confidence: float,
    right_confidence: float,
    left_fingers: list[int],
    right_fingers: list[int],
    state: str,
) -> str:
    combined = " ".join(label for label in [left_label, right_label] if label)
    confidence = (left_confidence + right_confidence) / 2.0
    return json.dumps({
        "type": "gesture_detected",
        "label": combined,
        "leftLabel": left_label,
        "rightLabel": right_label,
        "confidence": round(confidence, 3),
        "leftConfidence": round(left_confidence, 3),
        "rightConfidence": round(right_confidence, 3),
        "state": state,
        "leftFingers": left_fingers,
        "rightFingers": right_fingers,
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


def build_dual_state_message(
    state: str,
    left_fingers: list[int] | None = None,
    right_fingers: list[int] | None = None,
) -> str:
    return json.dumps({
        "type": "system_state",
        "state": state,
        "label": "REST",
        "confidence": 1.0,
        "leftFingers": left_fingers or [],
        "rightFingers": right_fingers or [],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


def values_by_feature(vals: list[int]) -> dict[str, int]:
    names = ["index", "middle", "ring", "pinky", "thumb"]
    return dict(zip(names, vals))


def is_rest(vals: list[int]) -> bool:
    # Bypassed constraints: rely solely on ML model prediction
    return False


def passes_class_gate(label: str, vals: list[int]) -> bool:
    # Bypassed constraints: trust ML model predictions directly
    return True


def passes_live_gate(label: str, vals: list[int], alphabet_mode: bool) -> bool:
    # Bypassed constraints: trust ML model predictions directly
    return True



# ── WebSocket server ──────────────────────────────────────────────────────────

def request_csv_mode(ser) -> None:
    ser.write(b"m\n")
    ser.flush()


def read_csv_values(ser, port_name: str, debug: bool = False) -> list[int] | None:
    raw = ser.readline().decode(errors="ignore").strip()
    if debug and raw:
        print(f"[RAW:{port_name}] {raw!r}")
    if "Mode: STATUS" in raw or raw == "STATUS":
        if debug:
            print(f"[DBG:{port_name}] Arduino reported STATUS mode; requesting CSV mode")
        request_csv_mode(ser)
        return None
    if not raw or raw.startswith("#"):
        return None
    parts = raw.split(",")
    if len(parts) < 5:
        if debug:
            print(f"[DBG:{port_name}] skipped non-CSV line: {raw!r}")
        return None
    try:
        return [max(0, min(100, int(float(p)))) for p in parts[:5]]
    except ValueError:
        if debug:
            print(f"[DBG:{port_name}] skipped unparsable CSV line: {raw!r}")
        return None


def predict_values(model, features: list[str], vals: list[int], pd) -> tuple[str, float, list[int]]:
    live_values = values_by_feature(vals)
    selected_vals = [live_values[feature] for feature in features]
    X = pd.DataFrame([selected_vals], columns=features)
    label = str(model.predict(X)[0])
    confidence = 1.0
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[0]
        confidence = float(max(probs))
    return label, confidence, selected_vals


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
    model_labels = set(str(label).upper() for label in artifact.get("labels", []))
    alphabet_mode = (
        args.label_mode == "alphabet"
        or (
            args.label_mode == "auto"
            and bool(model_labels)
            and model_labels.issubset(ASL_ALPHABET_LABELS | {"REST"})
        )
    )

    print(f"[LIVE] Model loaded: {model_path}")
    print(f"[LIVE] Features: {features}")
    print(f"[LIVE] Label mode: {'ALPHABET' if alphabet_mode else 'WORD'}")
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

                    debug_counter += 1
                    if args.debug and (debug_counter <= 20 or debug_counter % 25 == 0):
                        print(f"[DBG] vals={vals} selected={selected_vals} pred={pred} conf={confidence:.2f}")

                    history.append(pred)
                    conf_history.append(confidence)
                    counts = Counter(history)
                    label, votes = counts.most_common(1)[0]
                    avg_conf = sum(conf_history) / len(conf_history)
                    gate_ok = passes_live_gate(label, vals, alphabet_mode)

                    if args.debug and debug_counter % 5 == 0:
                        print(
                            f"[DBG] vote_frame vals={vals} pred={pred} label={label} "
                            f"votes={votes}/{min_votes} avg_conf={avg_conf:.2f} gate={gate_ok}"
                        )

                    now = time.time()
                    if (
                        votes >= min_votes
                        and avg_conf >= min_conf
                        and gate_ok
                        and (now - last_time) >= cooldown
                    ):
                        packet = build_gesture_message(label, avg_conf, vals, "ACTIVE")
                        print(f"[TX] {packet}")
                        asyncio.run_coroutine_threadsafe(broadcast(packet), loop)
                        last_time = now
                        history.clear()
                        conf_history.clear()

                    if args.loop_delay > 0:
                        time.sleep(args.loop_delay)


        except Exception as e:
            print(f"[LIVE] Error: {e} — retrying in 3s...")
            time.sleep(3)


# ── Main ──────────────────────────────────────────────────────────────────────

def dual_live_prediction_thread(args: argparse.Namespace, loop: asyncio.AbstractEventLoop) -> None:
    """
    Read two Arduino serial ports, classify each glove independently, and send
    one combined WebSocket packet with left/right labels and finger values.
    """
    try:
        import joblib
        import pandas as pd
        import serial
    except ImportError:
        print("[DUAL] Missing deps: pip install pyserial joblib scikit-learn pandas")
        return

    left_model_path = Path(args.left_model or args.model)
    right_model_path = Path(args.right_model or args.model)
    if not left_model_path.exists():
        print(f"[DUAL] Left model not found: {left_model_path}")
        return
    if not right_model_path.exists():
        print(f"[DUAL] Right model not found: {right_model_path}")
        return

    left_artifact = joblib.load(left_model_path)
    right_artifact = joblib.load(right_model_path)
    left_model = left_artifact["model"]
    right_model = right_artifact["model"]
    left_features = left_artifact.get("features", ["index", "middle", "ring", "pinky", "thumb"])
    right_features = right_artifact.get("features", ["index", "middle", "ring", "pinky", "thumb"])

    print(f"[DUAL] Left model loaded : {left_model_path}")
    print(f"[DUAL] Left features     : {left_features}")
    print(f"[DUAL] Right model loaded: {right_model_path}")
    print(f"[DUAL] Right features    : {right_features}")
    print(f"[DUAL] Opening left serial {args.left_port} @ {args.baud}...")
    print(f"[DUAL] Opening right serial {args.right_port} @ {args.baud}...")

    from collections import Counter, deque

    left_history: deque[str] = deque(maxlen=args.window)
    right_history: deque[str] = deque(maxlen=args.window)
    left_conf_history: deque[float] = deque(maxlen=args.window)
    right_conf_history: deque[float] = deque(maxlen=args.window)
    last_time = 0.0
    last_left: list[int] = []
    last_right: list[int] = []

    while True:
        try:
            with serial.Serial(args.left_port, args.baud, timeout=0.2) as left_ser, serial.Serial(
                args.right_port, args.baud, timeout=0.2
            ) as right_ser:
                time.sleep(2.0)
                left_ser.reset_input_buffer()
                right_ser.reset_input_buffer()
                request_csv_mode(left_ser)
                request_csv_mode(right_ser)
                time.sleep(0.5)
                ready = build_dual_state_message("READY", [], [])
                print(f"[TX] {ready}")
                asyncio.run_coroutine_threadsafe(broadcast(ready), loop)
                print("[DUAL] Both serial ports open. Waiting for two-glove gestures...")

                while True:
                    if left_ser.in_waiting > 1000:
                        left_ser.reset_input_buffer()
                    if right_ser.in_waiting > 1000:
                        right_ser.reset_input_buffer()

                    left_vals = read_csv_values(left_ser, "L", args.debug)
                    right_vals = read_csv_values(right_ser, "R", args.debug)
                    if left_vals is not None:
                        last_left = left_vals
                        left_label, left_conf, left_selected = predict_values(left_model, left_features, left_vals, pd)
                        left_history.append(left_label)
                        left_conf_history.append(left_conf)
                        if args.debug:
                            print(
                                f"[DBG:L] vals={left_vals} selected={left_selected} "
                                f"pred={left_label} conf={left_conf:.2f}"
                            )
                    if right_vals is not None:
                        last_right = right_vals
                        right_label, right_conf, right_selected = predict_values(right_model, right_features, right_vals, pd)
                        right_history.append(right_label)
                        right_conf_history.append(right_conf)
                        if args.debug:
                            print(
                                f"[DBG:R] vals={right_vals} selected={right_selected} "
                                f"pred={right_label} conf={right_conf:.2f}"
                            )

                    if len(left_history) < args.min_votes or len(right_history) < args.min_votes:
                        continue

                    left_label, left_votes = Counter(left_history).most_common(1)[0]
                    right_label, right_votes = Counter(right_history).most_common(1)[0]
                    left_avg_conf = sum(left_conf_history) / len(left_conf_history)
                    right_avg_conf = sum(right_conf_history) / len(right_conf_history)
                    now = time.time()
                    if args.debug:
                        print(
                            f"[DBG:DUAL] L={left_label} {left_votes}/{args.min_votes} {left_avg_conf:.2f} "
                            f"R={right_label} {right_votes}/{args.min_votes} {right_avg_conf:.2f}"
                        )

                    if (
                        left_votes >= args.min_votes
                        and right_votes >= args.min_votes
                        and left_avg_conf >= args.confidence
                        and right_avg_conf >= args.confidence
                        and (now - last_time) >= args.cooldown
                    ):
                        packet = build_dual_gesture_message(
                            left_label,
                            right_label,
                            left_avg_conf,
                            right_avg_conf,
                            last_left,
                            last_right,
                            "ACTIVE",
                        )
                        print(f"[TX] {packet}")
                        asyncio.run_coroutine_threadsafe(broadcast(packet), loop)
                        last_time = now
                        left_history.clear()
                        right_history.clear()
                        left_conf_history.clear()
                        right_conf_history.clear()

                    if args.loop_delay > 0:
                        time.sleep(args.loop_delay)

        except Exception as e:
            print(f"[DUAL] Error: {e} - retrying in 3s...")
            time.sleep(3)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smart Glove WebSocket bridge for mobile app",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--mode",       default="live", choices=["live", "live-dual"],
                        help="live = one Arduino AI | live-dual = two Arduino gloves")
    parser.add_argument("--port",       default="COM4",
                        help="Arduino serial port (live mode only), e.g. COM4")
    parser.add_argument("--left-port",  default="COM4",
                        help="Left glove Arduino serial port (live-dual mode), e.g. COM4")
    parser.add_argument("--right-port", default="COM5",
                        help="Right glove Arduino serial port (live-dual mode), e.g. COM5")
    parser.add_argument("--baud",       type=int, default=115200)
    parser.add_argument("--model",      default=str(Path(__file__).resolve().parents[1] / "models" / "asl_alphabet_5finger_model.joblib"),
                        help="Path to trained .joblib model (live mode only)")
    parser.add_argument("--left-model", default=None,
                        help="Path to trained left-glove .joblib model (live-dual mode). Defaults to --model")
    parser.add_argument("--right-model", default=None,
                        help="Path to trained right-glove .joblib model (live-dual mode). Defaults to --model")
    parser.add_argument("--label-mode", default="auto", choices=["auto", "word", "alphabet"],
                        help="word = strict word gates | alphabet = accept stable A-Z labels | auto = infer from model labels")
    parser.add_argument("--ws-host",    default="0.0.0.0",
                        help="WebSocket host (0.0.0.0 = accept all interfaces)")
    parser.add_argument("--ws-port",    type=int, default=8765,
                        help="WebSocket port (default 8765)")
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
    parser.add_argument("--cooldown",   type=float, default=4.0,
                        help="Speech cooldown in seconds")
    parser.add_argument("--loop-delay", type=float, default=0.02,
                        help="Small delay in seconds inside the serial reading loop to throttle execution")
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
    elif args.mode == "live-dual":
        t = threading.Thread(
            target=dual_live_prediction_thread,
            args=(args, loop),
            daemon=True,
        )
        t.start()
        async with serve(ws_handler, args.ws_host, args.ws_port):
            await asyncio.Future()   # run forever


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
