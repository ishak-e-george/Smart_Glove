from __future__ import annotations

import argparse
import asyncio
import json
import sys
import threading
import time
from pathlib import Path

import joblib
import pandas as pd
import serial
import websockets
from serial import SerialException

from common import DEFAULT_BAUD_RATE, DEFAULT_GESTURE_TO_WORD, FEATURE_COLUMNS, parse_sensor_line

connected_clients: set[websockets.ServerConnection] = set()


def infer_clear_two_finger_gesture(parsed: dict[str, int]) -> str | None:
    index_percent = parsed.get("indexPercent")
    middle_percent = parsed.get("middlePercent")

    if index_percent is None or middle_percent is None:
        return None

    if index_percent <= 25 and middle_percent <= 25:
        return "REST"

    if index_percent >= 45 and index_percent - middle_percent >= 15:
        return "INDEX_BENT"
    if middle_percent >= 45 and middle_percent - index_percent >= 15:
        return "MIDDLE_BENT"

    return None


def classify_live_gesture(
    parsed: dict[str, int],
    model_prediction: str,
    feature_set: str | None,
) -> str:
    if feature_set == "2":
        return infer_clear_two_finger_gesture(parsed) or "UNKNOWN"
    return infer_clear_two_finger_gesture(parsed) or model_prediction


def passes_gesture_sanity_gate(prediction: str, parsed: dict[str, int]) -> bool:
    index_percent = parsed.get("indexPercent")
    middle_percent = parsed.get("middlePercent")

    if index_percent is None or middle_percent is None:
        return True

    if prediction == "REST":
        return index_percent <= 25 and middle_percent <= 25
    if prediction == "INDEX_BENT":
        return index_percent >= 45 and index_percent - middle_percent >= 15
    if prediction == "MIDDLE_BENT":
        return middle_percent >= 45 and middle_percent - index_percent >= 15

    return True


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run live gesture prediction and stream results to the browser over WebSocket."
    )
    parser.add_argument("--port", required=True, help="Arduino serial port, for example COM4")
    parser.add_argument(
        "--baud",
        type=int,
        default=DEFAULT_BAUD_RATE,
        help="Serial baud rate",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "models" / "gesture_model.joblib",
        help="Trained model path",
    )
    parser.add_argument(
        "--ws-host",
        default="127.0.0.1",
        help="WebSocket host",
    )
    parser.add_argument(
        "--ws-port",
        type=int,
        default=8765,
        help="WebSocket port",
    )
    parser.add_argument(
        "--hold-seconds",
        type=float,
        default=0.4,
        help="Required stable time before accepting a gesture",
    )
    parser.add_argument(
        "--cooldown-seconds",
        type=float,
        default=2.0,
        help="Minimum time before repeating the same word",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.70,
        help="Minimum model confidence required before accepting a gesture",
    )
    parser.add_argument(
        "--startup-ignore-seconds",
        type=float,
        default=2.0,
        help="Ignore gesture acceptance for this many seconds after serial connects",
    )
    parser.add_argument(
        "--debug-live",
        action="store_true",
        help="Print live percent readings and current classified gesture for debugging",
    )
    return parser


async def websocket_handler(websocket: websockets.ServerConnection) -> None:
    connected_clients.add(websocket)
    print("Browser client connected")
    try:
        await websocket.wait_closed()
    finally:
        connected_clients.discard(websocket)
        print("Browser client disconnected")


async def broadcast_message(message: dict[str, object]) -> None:
    if not connected_clients:
        return

    payload = json.dumps(message)
    disconnected: list[websockets.ServerConnection] = []

    for client in connected_clients:
        try:
            await client.send(payload)
        except Exception:
            disconnected.append(client)

    for client in disconnected:
        connected_clients.discard(client)


def serial_prediction_loop(args: argparse.Namespace, loop: asyncio.AbstractEventLoop) -> None:
    if not args.model.exists():
        print(f"Model not found: {args.model}", file=sys.stderr)
        return

    artifact = joblib.load(args.model)
    model = artifact["model"]
    feature_set = artifact.get("feature_set")
    feature_columns = artifact.get("feature_columns", FEATURE_COLUMNS)
    percent_columns = [column for column in feature_columns if column.endswith("Percent")]
    has_predict_proba = hasattr(model, "predict_proba")

    print(f"Opening {args.port} at {args.baud} baud")
    print(f"Using model: {args.model}")
    print(f"Hold threshold: {args.hold_seconds:.2f}s")
    print(f"Cooldown: {args.cooldown_seconds:.2f}s")
    print(f"Min confidence: {args.min_confidence:.2f}")
    print(f"Startup ignore: {args.startup_ignore_seconds:.2f}s")

    last_prediction: str | None = None
    prediction_started_at: float | None = None
    accepted_prediction: str | None = None
    last_word: str | None = None
    last_word_time = 0.0
    last_debug_at = 0.0

    while True:
        try:
            print(f"Opening {args.port} at {args.baud} baud")
            with serial.Serial(args.port, args.baud, timeout=1) as connection:
                print("Serial connection opened")
                connection.reset_input_buffer()
                startup_ignore_until = time.monotonic() + args.startup_ignore_seconds
                last_prediction = None
                prediction_started_at = None
                accepted_prediction = "REST"

                while True:
                    raw_line = connection.readline().decode("utf-8", errors="ignore")
                    parsed = parse_sensor_line(raw_line, feature_set=artifact.get("feature_set"))
                    if parsed is None:
                        continue

                    if any(parsed[column] == -1 for column in percent_columns):
                        continue

                    feature_row = pd.DataFrame(
                        [[parsed[column] for column in feature_columns]],
                        columns=feature_columns,
                    )
                    model_prediction = str(model.predict(feature_row)[0])
                    prediction = classify_live_gesture(parsed, model_prediction, feature_set)
                    confidence = 1.0
                    if has_predict_proba and prediction == model_prediction:
                        probabilities = model.predict_proba(feature_row)[0]
                        confidence = float(max(probabilities))
                    now = time.monotonic()

                    if args.debug_live and now - last_debug_at >= 0.25:
                        index_percent = parsed.get("indexPercent", -999)
                        middle_percent = parsed.get("middlePercent", -999)
                        print(
                            f"LIVE index={index_percent:>3} middle={middle_percent:>3} "
                            f"prediction={prediction} model={model_prediction} confidence={confidence:.2f}"
                        )
                        last_debug_at = now

                    if now < startup_ignore_until:
                        last_prediction = None
                        prediction_started_at = None
                        accepted_prediction = "REST"
                        continue

                    if prediction == "UNKNOWN":
                        last_prediction = None
                        prediction_started_at = None
                        continue

                    if not passes_gesture_sanity_gate(prediction, parsed):
                        if prediction == "REST":
                            accepted_prediction = None
                            rest_armed = False
                        continue

                    if prediction != last_prediction:
                        last_prediction = prediction
                        prediction_started_at = now
                        continue

                    if prediction_started_at is None or now - prediction_started_at < args.hold_seconds:
                        continue

                    if prediction == "REST":
                        accepted_prediction = "REST"
                        continue

                    if prediction == accepted_prediction:
                        continue

                    if confidence < args.min_confidence:
                        continue

                    word = DEFAULT_GESTURE_TO_WORD.get(prediction, prediction)

                    if word and word == last_word and now - last_word_time < args.cooldown_seconds:
                        continue

                    accepted_prediction = prediction
                    if word:
                        last_word = word
                        last_word_time = now

                    print(f"Accepted gesture: {prediction} -> {word or '(no output)'} | confidence={confidence:.2f}")
                    message = {
                        "gesture": prediction,
                        "word": word,
                        "confidence": confidence,
                        "timestamp": time.time(),
                    }
                    asyncio.run_coroutine_threadsafe(broadcast_message(message), loop)
        except SerialException as error:
            print(f"Serial error: {error}")
        except Exception as error:
            print(f"Prediction loop error: {error}")

        print("Retrying serial connection in 2 seconds...")
        time.sleep(2)


async def main_async() -> None:
    args = build_arg_parser().parse_args()
    loop = asyncio.get_running_loop()

    prediction_thread = threading.Thread(
        target=serial_prediction_loop,
        args=(args, loop),
        daemon=True,
    )
    prediction_thread.start()

    print(f"Starting WebSocket server on ws://{args.ws_host}:{args.ws_port}")
    async with websockets.serve(websocket_handler, args.ws_host, args.ws_port):
        await asyncio.Future()


def main() -> int:
    try:
        asyncio.run(main_async())
        return 0
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
