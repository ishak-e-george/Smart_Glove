#!/usr/bin/env python3
"""
Smart Glove — Dataset Audit & Cleaner

Checks your collected CSV for:
  - Row counts per label
  - Bad rows (wrong column count, out-of-range values)
  - Suspicious batches (timestamp clusters where values look wrong)
  - Duplicate rows

Usage:
  python python/audit_dataset.py
  python python/audit_dataset.py --data data/raw/smart_glove_5word_dataset.csv
  python python/audit_dataset.py --data data/raw/smart_glove_5word_dataset.csv --clean
  python python/audit_dataset.py --data data/raw/smart_glove_5word_dataset.csv --clean --min-rows 60

Flags:
  --data      Path to dataset CSV (default: data/raw/smart_glove_5word_dataset.csv)
  --clean     Write a cleaned version to data/raw/smart_glove_5word_dataset_CLEAN.csv
  --min-rows  Warn if a label has fewer than this many rows (default: 60)
  --verbose   Print every rejected row
"""

from __future__ import annotations

import argparse
from pathlib import Path
from collections import defaultdict
import sys

try:
    import pandas as pd
except ImportError:
    print("Missing dependency: pip install pandas")
    sys.exit(1)

FEATURES     = ["index", "middle", "ring", "pinky", "thumb"]
SEPARATOR    = "─" * 56
VALID_LABELS = {"REST", "HELLO", "YES", "NO", "THANK_YOU", "HELP"}


def audit(df: pd.DataFrame, min_rows: int, verbose: bool) -> pd.DataFrame:
    print(SEPARATOR)
    print("  Smart Glove — Dataset Audit")
    print(SEPARATOR)
    print(f"  Total rows loaded : {len(df)}")
    print()

    # ── Check required columns ───────────────────────────────────────────────
    required = set(FEATURES + ["label"])
    missing  = required - set(df.columns)
    if missing:
        print(f"  ERROR: Missing columns: {sorted(missing)}")
        print("  Cannot continue. Check your CSV file.")
        sys.exit(1)

    # ── Coerce feature columns to numeric ────────────────────────────────────
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["label"] = df["label"].astype(str).str.upper().str.strip()

    # ── Flag bad rows ────────────────────────────────────────────────────────
    bad_mask = pd.Series(False, index=df.index)

    # Any NaN in feature columns
    nan_mask = df[FEATURES].isna().any(axis=1)
    bad_mask |= nan_mask

    # Values outside 0–100
    for col in FEATURES:
        out_mask = (df[col] < 0) | (df[col] > 100)
        bad_mask |= out_mask

    # Unknown labels
    unknown_mask = ~df["label"].isin(VALID_LABELS)
    bad_mask     |= unknown_mask

    n_bad = bad_mask.sum()
    if n_bad > 0:
        print(f"  Bad rows found    : {n_bad}")
        if verbose:
            print(df[bad_mask].to_string())
        else:
            print("  (run with --verbose to see them)")
        print()
    else:
        print("  Bad rows          : 0  ✓")

    # ── Duplicate rows ───────────────────────────────────────────────────────
    dup_mask = df.duplicated(subset=FEATURES + ["label"], keep=False)
    n_dup    = dup_mask.sum()
    if n_dup > 0:
        print(f"  Duplicate rows    : {n_dup}  (keeping first occurrence)")
    else:
        print(f"  Duplicate rows    : 0  ✓")

    # ── Build clean dataframe ────────────────────────────────────────────────
    clean = df[~bad_mask].drop_duplicates(subset=FEATURES + ["label"], keep="first").copy()
    print(f"  Clean rows        : {len(clean)}")
    print()

    # ── Label counts ─────────────────────────────────────────────────────────
    print("  Rows per label:")
    counts = clean["label"].value_counts().sort_index()
    for label, count in counts.items():
        flag = ""
        if count < min_rows:
            flag = f"  ⚠  below {min_rows} — collect more"
        elif label not in VALID_LABELS:
            flag = "  ⚠  unexpected label"
        bar  = "█" * min(count // 5, 40)
        print(f"    {label:<12} {count:>4}  {bar}{flag}")
    print()

    # ── Missing labels ───────────────────────────────────────────────────────
    missing_labels = VALID_LABELS - set(counts.index)
    if missing_labels:
        print(f"  Missing labels    : {sorted(missing_labels)}")
        print("  These need to be collected before training.")
        print()

    # ── Per-label value stats (catch suspiciously flat batches) ──────────────
    print("  Per-label value ranges (spot frozen/flat sensors):")
    for label in sorted(VALID_LABELS):
        subset = clean[clean["label"] == label]
        if len(subset) == 0:
            print(f"    {label:<12}  no data")
            continue
        parts = []
        for col in FEATURES:
            lo = int(subset[col].min())
            hi = int(subset[col].max())
            rng = hi - lo
            warn = " !" if rng < 5 else ""
            parts.append(f"{col[0].upper()}:{lo}-{hi}{warn}")
        print(f"    {label:<12}  {' | '.join(parts)}")
    print()

    # ── REST sanity check ────────────────────────────────────────────────────
    rest = clean[clean["label"] == "REST"]
    if len(rest) > 0:
        rest_high = rest[FEATURES].max(axis=1)
        noisy_rest = (rest_high > 40).sum()
        if noisy_rest > 0:
            pct = noisy_rest / len(rest) * 100
            print(f"  REST quality      : {noisy_rest} rows ({pct:.0f}%) have a finger above 40%")
            print("                      These may confuse the model. Consider recollecting REST.")
        else:
            print(f"  REST quality      : clean ✓  (all fingers ≤ 40 in REST rows)")
        print()

    # ── Summary verdict ──────────────────────────────────────────────────────
    print(SEPARATOR)
    all_ok = all(counts.get(l, 0) >= min_rows for l in VALID_LABELS)
    if all_ok and n_bad == 0:
        print("  Dataset looks good. Ready to retrain.")
    else:
        print("  Action needed before retraining:")
        for label in sorted(VALID_LABELS):
            c = counts.get(label, 0)
            if c < min_rows:
                needed = min_rows - c
                print(f"    Collect {needed:>3} more rows for {label}")
        if n_bad > 0:
            print(f"    {n_bad} bad rows will be removed in --clean output")
    print(SEPARATOR)
    print()

    return clean


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",     default="data/raw/smart_glove_5word_dataset.csv")
    parser.add_argument("--clean",    action="store_true", help="Write cleaned CSV")
    parser.add_argument("--min-rows", type=int, default=60)
    parser.add_argument("--verbose",  action="store_true")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"Dataset not found: {data_path}")
        return 2

    df    = pd.read_csv(data_path)
    clean = audit(df, args.min_rows, args.verbose)

    if args.clean:
        out_path = data_path.parent / (data_path.stem + "_CLEAN.csv")
        clean.to_csv(out_path, index=False)
        print(f"  Cleaned dataset saved to: {out_path.resolve()}")
        print(f"  Rows: {len(df)} → {len(clean)}  (removed {len(df) - len(clean)})")
        print()
        print("  To retrain on the clean dataset:")
        print(f"  python python/train_5finger_word_model.py --data {out_path}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())