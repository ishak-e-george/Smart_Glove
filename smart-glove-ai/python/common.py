from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable, Optional

FEATURE_SETS: dict[str, list[str]] = {
    "2": [
        "indexRaw",
        "indexSmooth",
        "indexPercent",
        "middleRaw",
        "middleSmooth",
        "middlePercent",
    ],
    "3": [
        "indexRaw",
        "indexSmooth",
        "indexPercent",
        "middleRaw",
        "middleSmooth",
        "middlePercent",
        "ringRaw",
        "ringSmooth",
        "ringPercent",
    ],
    "5": [
        "indexRaw",
        "indexSmooth",
        "indexPercent",
        "middleRaw",
        "middleSmooth",
        "middlePercent",
        "ringRaw",
        "ringSmooth",
        "ringPercent",
        "pinkyRaw",
        "pinkySmooth",
        "pinkyPercent",
        "thumbRaw",
        "thumbSmooth",
        "thumbPercent",
    ],
}

FEATURE_COLUMNS = FEATURE_SETS["2"]
CSV_COLUMNS = FEATURE_COLUMNS + ["label"]

DEFAULT_BAUD_RATE = 115200
DEFAULT_FEATURE_SET = "2"
DEFAULT_GESTURE_TO_WORD = {
    "REST": "",
    "INDEX_BENT": "Yes",
    "MIDDLE_BENT": "No",
    "BOTH_BENT": "Help",
    "INDEX_HALF": "Water",
}


def get_feature_columns(feature_set: str) -> list[str]:
    if feature_set not in FEATURE_SETS:
        raise ValueError(f"Unsupported feature set: {feature_set}")
    return FEATURE_SETS[feature_set]


def get_csv_columns(feature_set: str) -> list[str]:
    return get_feature_columns(feature_set) + ["label"]


def infer_feature_set_from_width(width: int) -> Optional[str]:
    for feature_set, columns in FEATURE_SETS.items():
        if len(columns) == width:
            return feature_set
    return None


def ensure_dataset_file(csv_path: Path, feature_set: str) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    if csv_path.exists() and csv_path.stat().st_size > 0:
        return
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=get_csv_columns(feature_set))
        writer.writeheader()


def parse_sensor_line(line: str, feature_set: str | None = None) -> Optional[dict[str, int]]:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None

    parts = stripped.split(",")
    resolved_feature_set = feature_set or infer_feature_set_from_width(len(parts))
    if resolved_feature_set is None:
        return None

    feature_columns = get_feature_columns(resolved_feature_set)
    if len(parts) != len(feature_columns):
        return None

    try:
        values = [int(part) for part in parts]
    except ValueError:
        return None

    return dict(zip(feature_columns, values))


def append_dataset_rows(csv_path: Path, rows: Iterable[dict[str, object]], feature_set: str) -> None:
    ensure_dataset_file(csv_path, feature_set)
    with csv_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=get_csv_columns(feature_set))
        for row in rows:
            writer.writerow(row)
