# Run via: python -m app.scripts.validate_hardware_samples
from __future__ import annotations

import argparse
from pathlib import Path

from app.scripts.import_serial_capture import SUPPORTED_LABELS, parse_serial_samples


DEFAULT_SAMPLE_DIR = Path("hardware_samples")
TARGET_ROWS = 30

EXPECTED_RANGES = {
    "REST": {"index": (0, 20), "middle": (0, 20)},
    "INDEX_BENT": {"index": (60, 100), "middle": (0, 20)},
    "MIDDLE_BENT": {"index": (0, 20), "middle": (60, 100)},
}

DEFAULT_FILES = {
    "REST": "rest.txt",
    "INDEX_BENT": "index_bent.txt",
    "MIDDLE_BENT": "middle_bent.txt",
}


def percent_in_range(value: float, bounds: tuple[int, int]) -> bool:
    return bounds[0] <= value <= bounds[1]


def validate_label(label: str, sample_file: Path) -> dict[str, object]:
    samples = parse_serial_samples(sample_file.read_text(encoding="utf-8")) if sample_file.exists() else []
    ranges = EXPECTED_RANGES[label]
    clean_rows = 0
    rejected_rows = 0

    for sample in samples:
        index_percent = sample[2]
        middle_percent = sample[5]
        if percent_in_range(index_percent, ranges["index"]) and percent_in_range(middle_percent, ranges["middle"]):
            clean_rows += 1
        else:
            rejected_rows += 1

    return {
        "label": label,
        "file": str(sample_file),
        "rows": len(samples),
        "clean_rows": clean_rows,
        "rejected_rows": rejected_rows,
        "target_rows": TARGET_ROWS,
        "ready": clean_rows >= TARGET_ROWS,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate real Arduino hardware sample files.")
    parser.add_argument("--dir", type=Path, default=DEFAULT_SAMPLE_DIR, help="Directory containing rest/index/middle text files.")
    parser.add_argument("--strict", action="store_true", help="Return non-zero until every label has 30 clean rows.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    print("Smart Glove Hardware Sample Validation")
    print("--------------------------------------")

    results = [
        validate_label(label, args.dir / DEFAULT_FILES[label])
        for label in sorted(SUPPORTED_LABELS)
    ]

    for result in results:
        status = "READY" if result["ready"] else "NEEDS_MORE"
        print(f"{result['label']}: {status}")
        print(f"  File: {result['file']}")
        print(f"  Rows: {result['rows']}")
        print(f"  Clean rows: {result['clean_rows']} / {result['target_rows']}")
        print(f"  Rejected rows: {result['rejected_rows']}")

    if args.strict and not all(result["ready"] for result in results):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
