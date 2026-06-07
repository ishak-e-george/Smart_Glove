#!/usr/bin/env python3
"""
Remove all rows for one label from the raw Smart Glove dataset.

Run:
    python python/remove_label_rows.py --label INDEX_BENT
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--label", required=True)
    p.add_argument("--csv", default="data/raw/smart_glove_5f_dataset.csv")
    args = p.parse_args()

    path = Path(args.csv)
    if not path.exists():
        print(f"Dataset not found: {path}")
        return 1

    df = pd.read_csv(path)
    before = len(df)
    df = df[df["label"] != args.label]
    after = len(df)

    backup = path.with_suffix(path.suffix + ".before_remove_backup")
    path.replace(backup)
    df.to_csv(path, index=False)

    print(f"Removed label: {args.label}")
    print(f"Rows before: {before}")
    print(f"Rows after:  {after}")
    print(f"Removed:     {before - after}")
    print(f"Backup saved: {backup}")
    print(f"Updated CSV:  {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
