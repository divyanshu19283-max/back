"""
CSV ingestion pipeline.

Expected input CSV columns (matches the problem statement spec):
date,origin,destination,commodity,vessel_type,vessel_size,freight_rate,
fuel_price,demand_index,supply_index,port_congestion_index

Pipeline steps:
    1. schema validation (required columns present)
    2. date parsing
    3. numeric validation / coercion
    4. missing-value handling
    5. duplicate detection
    6. outlier detection (IQR-based, flagged not silently dropped)
    7. normalization is NOT applied to the stored raw rate (we keep raw $/ton
       so the DB stays human-readable); normalization for modeling happens
       later in the feature engineering step, not at ingestion time.
    8. DB insertion (bulk upsert, skips exact duplicates)

Returns an IngestionReport so the caller (API route or CLI) can show the
user exactly what happened to their file — this matters for a hackathon
demo where judges will want to see "yes, this is really validating data".
"""
from __future__ import annotations
import io
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.freight import FreightRate

REQUIRED_COLUMNS = [
    "date", "origin", "destination", "commodity", "vessel_type", "vessel_size",
    "freight_rate", "fuel_price", "demand_index", "supply_index",
    "port_congestion_index",
]

NUMERIC_COLUMNS = [
    "freight_rate", "fuel_price", "demand_index", "supply_index",
    "port_congestion_index",
]


@dataclass
class IngestionReport:
    filename: str = "uploaded.csv"
    rows_received: int = 0
    rows_after_cleaning: int = 0
    rows_inserted: int = 0
    rows_skipped_duplicate_in_file: int = 0
    rows_skipped_duplicate_in_db: int = 0
    rows_dropped_missing_required: int = 0
    rows_with_missing_values_filled: int = 0
    rows_dropped_bad_date: int = 0
    rows_dropped_non_numeric: int = 0
    outliers_flagged: int = 0
    outlier_examples: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    success: bool = False

    def as_dict(self):
        return self.__dict__


def validate_columns(df: pd.DataFrame) -> Optional[str]:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        return f"Missing required columns: {missing}"
    return None


def _detect_outliers_iqr(series: pd.Series, k: float = 3.0) -> pd.Series:
    """IQR-based outlier flag. k=3 (not the usual 1.5) because freight rates
    legitimately spike during real market events — we want to flag extreme
    values for review, not aggressively delete plausible spikes."""
    q1, q3 = series.quantile(0.25), series.quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - k * iqr, q3 + k * iqr
    return (series < lower) | (series > upper)


def clean_dataframe(df: pd.DataFrame, report: IngestionReport) -> pd.DataFrame:
    df = df.copy()
    report.rows_received = len(df)

    # 1. required-field completeness (categorical identity columns)
    id_cols = ["origin", "destination", "commodity", "vessel_type", "vessel_size"]
    before = len(df)
    df = df.dropna(subset=id_cols + ["date"])
    report.rows_dropped_missing_required = before - len(df)

    # 2. date parsing
    before = len(df)
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    bad_dates = df["date"].isna()
    report.rows_dropped_bad_date = int(bad_dates.sum())
    df = df[~bad_dates]

    # 3. numeric validation / coercion
    for col in NUMERIC_COLUMNS:
        before_numeric = df[col].copy()
        df[col] = pd.to_numeric(df[col], errors="coerce")
    non_numeric_mask = df[NUMERIC_COLUMNS].isna().any(axis=1)
    # distinguish "was NaN in source" (missing) vs "failed numeric coercion"
    # — here we treat any resulting NaN in numeric cols as missing-value case,
    # handled by the fill step below, EXCEPT freight_rate itself (the target)
    # which we cannot impute meaningfully, so those rows are dropped.
    before = len(df)
    df = df[~df["freight_rate"].isna()]
    report.rows_dropped_non_numeric = before - len(df)

    # 4. missing-value handling for feature columns (median-impute per route)
    fillable = ["fuel_price", "demand_index", "supply_index", "port_congestion_index"]
    missing_before = df[fillable].isna().sum().sum()
    if missing_before > 0:
        df[fillable] = df.groupby(["origin", "vessel_type"])[fillable].transform(
            lambda s: s.fillna(s.median())
        )
        # any still-missing (whole group was NaN) -> global median fallback
        df[fillable] = df[fillable].fillna(df[fillable].median())
    report.rows_with_missing_values_filled = int(missing_before)

    # sanity bounds: negative rates/prices are invalid, not just outliers
    for col in ["freight_rate", "fuel_price"] + [
        c for c in fillable if c != "fuel_price"
    ]:
        df = df[df[col] >= 0]

    # 5. duplicate detection within the file itself
    dedup_keys = ["date", "origin", "destination", "commodity", "vessel_type", "vessel_size"]
    before = len(df)
    df = df.drop_duplicates(subset=dedup_keys, keep="first")
    report.rows_skipped_duplicate_in_file = before - len(df)

    # 6. outlier detection (flag, don't drop) — per route+vessel_type group
    outlier_mask = pd.Series(False, index=df.index)
    for _, grp in df.groupby(["origin", "vessel_type"]):
        if len(grp) < 10:
            continue
        flags = _detect_outliers_iqr(grp["freight_rate"])
        outlier_mask.loc[grp.index[flags]] = True
    report.outliers_flagged = int(outlier_mask.sum())
    if report.outliers_flagged:
        examples = df[outlier_mask].head(5)
        report.outlier_examples = [
            {
                "date": str(r["date"]), "origin": r["origin"],
                "vessel_type": r["vessel_type"], "freight_rate": r["freight_rate"],
            }
            for _, r in examples.iterrows()
        ]
    df["is_outlier_flag"] = outlier_mask  # informational only, not persisted to DB

    report.rows_after_cleaning = len(df)
    return df


def ingest_dataframe(
    df: pd.DataFrame,
    db: Session,
    filename: str = "uploaded.csv",
    is_synthetic: bool = False,
) -> IngestionReport:
    report = IngestionReport(filename=filename)

    col_error = validate_columns(df)
    if col_error:
        report.errors.append(col_error)
        return report

    df = clean_dataframe(df, report)
    if df.empty:
        report.warnings.append("No valid rows remained after cleaning.")
        report.success = True
        return report

    # 7. DB insertion — skip rows that already exist (dedup against DB)
    existing = set(
        db.execute(
            select(
                FreightRate.date, FreightRate.origin, FreightRate.destination,
                FreightRate.commodity, FreightRate.vessel_type, FreightRate.vessel_size,
            )
        ).all()
    )

    to_insert = []
    for _, row in df.iterrows():
        key = (
            row["date"], row["origin"], row["destination"],
            row["commodity"], row["vessel_type"], row["vessel_size"],
        )
        if key in existing:
            report.rows_skipped_duplicate_in_db += 1
            continue
        existing.add(key)
        to_insert.append(
            FreightRate(
                date=row["date"],
                origin=row["origin"],
                destination=row["destination"],
                commodity=row["commodity"],
                vessel_type=row["vessel_type"],
                vessel_size=row["vessel_size"],
                freight_rate=float(row["freight_rate"]),
                fuel_price=float(row["fuel_price"]),
                demand_index=float(row["demand_index"]),
                supply_index=float(row["supply_index"]),
                port_congestion_index=float(row["port_congestion_index"]),
                is_synthetic=is_synthetic,
            )
        )

    if to_insert:
        db.bulk_save_objects(to_insert)
        db.commit()

    report.rows_inserted = len(to_insert)
    report.success = True
    return report


def ingest_csv_bytes(
    content: bytes, db: Session, filename: str = "uploaded.csv", is_synthetic: bool = False
) -> IngestionReport:
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:  # noqa: BLE001
        r = IngestionReport(filename=filename)
        r.errors.append(f"Could not parse CSV: {e}")
        return r
    return ingest_dataframe(df, db, filename=filename, is_synthetic=is_synthetic)
