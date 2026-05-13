# Run via: python -m app.scripts.preprocess_recordings
import json
import os
import glob
import numpy as np

def preprocess_file(file_path: str):
    """
    Example preprocessing:
    - Load JSON
    - Normalize sensor values (0-1023 -> 0.0-1.0)
    - Convert to numpy array
    """
    with open(file_path, "r") as f:
        data = json.load(f)
    
    samples = np.array(data["samples"])
    
    # Simple normalization
    normalized_samples = samples / 1023.0
    
    return {
        "gesture_code": data["gesture_code"],
        "features": normalized_samples.tolist(),
        "shape": normalized_samples.shape
    }

def main():
    # Look for files in the assets folder
    assets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "assets", "mock_recordings"))
    files = glob.glob(os.path.join(assets_dir, "*.json"))
    
    if not files:
        print(f"No mock files found in {assets_dir}. Run generate_mock_recordings.py first.")
        return

    print(f"Preprocessing {len(files)} files...")
    processed_data = []
    for f in files:
        result = preprocess_file(f)
        processed_data.append(result)
        print(f"  Processed {os.path.basename(f)} - Shape: {result['shape']}")

    # Save processed features for training
    output_path = os.path.join(assets_dir, "..", "processed_features.json")
    with open(output_path, "w") as out:
        json.dump(processed_data, out)
    
    print(f"\nPreprocessed features saved to {output_path}")

if __name__ == "__main__":
    main()
