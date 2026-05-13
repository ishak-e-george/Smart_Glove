# Run via: python -m app.scripts.generate_mock_recordings
import json
import os
import math
import uuid

def generate_mock_recording(gesture_code: str, device_id: int):
    sample_rate = 50
    duration_ms = 2000
    num_samples = (duration_ms // 1000) * sample_rate
    sensor_count = 5
    
    samples = []
    for i in range(num_samples):
        # Simulate sine-wave-like sensor values (0-1023 range)
        t = i / sample_rate
        sample = [
            int(512 + 200 * math.sin(2 * math.pi * 1 * t + (j * 0.5)))
            for j in range(sensor_count)
        ]
        samples.append(sample)

    data = {
        "device_id": device_id,
        "gesture_code": gesture_code,
        "sample_rate": sample_rate,
        "duration_ms": duration_ms,
        "sensor_count": sensor_count,
        "samples": samples
    }

    filename = f"mock_{gesture_code}_{uuid.uuid4().hex[:8]}.json"
    
    # Save to a dedicated assets folder at the project root
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "assets", "mock_recordings"))
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, filename)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Generated: {filename} at {output_path}")

if __name__ == "__main__":
    for g in ["HELP", "WATER", "PAIN"]:
        # Generating 3 samples per gesture
        for _ in range(3):
            generate_mock_recording(g, 1)
