"""
Exploratory Data Analysis module.

Reads freight_rates from the DB and computes descriptive statistics,
seasonal patterns, route/vessel comparisons, and feature correlations.
Results are returned as a JSON-serializable dict and also persisted to
data/trained_models/eda_summary.json so the frontend/dashboard (Phase 2)
can render it without recomputation.
"""
from __future__ import annotations
import json
import os
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.freight import FreightRate

EDA_OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "trained_models", "eda_summary.json",
)


def load_freight_dataframe(db: Session) -> pd.DataFrame:
    rows = db.execute(select(FreightRate)).scalars().all()
    data = [
        {
            "date": r.date, "origin": r.origin, "destination": r.destination,
            "commodity": r.commodity, "vessel_type": r.vessel_type,
            "vessel_size": r.vessel_size, "freight_rate": r.freight_rate,
            "fuel_price": r.fuel_price, "demand_index": r.demand_index,
            "supply_index": r.supply_index,
            "port_congestion_index": r.port_congestion_index,
            "is_synthetic": r.is_synthetic,
        }
        for r in rows
    ]
    df = pd.DataFrame(data)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
    return df


def run_eda(db: Session, persist: bool = True) -> dict:
    df = load_freight_dataframe(db)
    if df.empty:
        return {"error": "No data available. Run ingestion / seed_data first."}

    df["month"] = df["date"].dt.month
    df["year"] = df["date"].dt.year

    summary = {
        "row_count": int(len(df)),
        "date_range": {
            "start": str(df["date"].min().date()),
            "end": str(df["date"].max().date()),
        },
        "synthetic_rows": int(df["is_synthetic"].sum()),
        "real_rows": int((~df["is_synthetic"]).sum()),
        "overall": {
            "mean_freight_rate": round(float(df["freight_rate"].mean()), 3),
            "median_freight_rate": round(float(df["freight_rate"].median()), 3),
            "min_freight_rate": round(float(df["freight_rate"].min()), 3),
            "max_freight_rate": round(float(df["freight_rate"].max()), 3),
            "std_freight_rate": round(float(df["freight_rate"].std()), 3),
        },
        "monthly_avg_freight_rate": {
            str(k): round(float(v), 3)
            for k, v in df.groupby("month")["freight_rate"].mean().sort_index().items()
        },
        "yearly_avg_freight_rate": {
            str(k): round(float(v), 3)
            for k, v in df.groupby("year")["freight_rate"].mean().sort_index().items()
        },
        "origin_avg_freight_rate": {
            k: round(float(v), 3)
            for k, v in df.groupby("origin")["freight_rate"].mean().sort_values(ascending=False).items()
        },
        "destination_avg_freight_rate": {
            k: round(float(v), 3)
            for k, v in df.groupby("destination")["freight_rate"].mean().items()
        },
        "vessel_type_comparison": {
            k: {
                "mean": round(float(v["mean"]), 3),
                "median": round(float(v["median"]), 3),
                "std": round(float(v["std"]), 3),
            }
            for k, v in df.groupby("vessel_type")["freight_rate"].agg(["mean", "median", "std"]).to_dict("index").items()
        },
        "correlation_with_freight_rate": {
            k: round(float(v), 4)
            for k, v in df[[
                "freight_rate", "fuel_price", "demand_index", "supply_index",
                "port_congestion_index",
            ]].corr()["freight_rate"].drop("freight_rate").items()
        },
    }

    # --- Chart-ready array shapes (additive; frontend market-data charts) --
    n_bins = 10
    rate_bins = pd.cut(df["freight_rate"], bins=n_bins)
    rate_counts = rate_bins.value_counts().sort_index()
    summary["rate_distribution"] = [
        {"bin": f"{iv.left:.0f}-{iv.right:.0f}", "count": int(c)}
        for iv, c in rate_counts.items()
    ]

    route_counts = (
        df.assign(route=df["origin"] + " \u2192 " + df["destination"])
        .groupby("route").size().sort_values(ascending=False)
    )
    summary["route_distribution"] = [
        {"route": route, "count": int(c)} for route, c in route_counts.items()
    ]

    monthly_series = (
        df.set_index("date")["freight_rate"].resample("MS").mean().dropna()
    )
    summary["historical_trend"] = [
        {"date": str(d.date()), "rate": round(float(v), 2)} for d, v in monthly_series.items()
    ]

    vessel_counts = df.groupby("vessel_type").size().sort_values(ascending=False)
    summary["vessel_distribution"] = [
        {"vessel": v, "count": int(c)} for v, c in vessel_counts.items()
    ]

    if persist:
        os.makedirs(os.path.dirname(EDA_OUTPUT_PATH), exist_ok=True)
        with open(EDA_OUTPUT_PATH, "w") as f:
            json.dump(summary, f, indent=2)

    return summary


if __name__ == "__main__":
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        result = run_eda(db)
        print(json.dumps(result, indent=2))
    finally:
        db.close()
