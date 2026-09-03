"""
Feature engineering for the freight-rate forecasting model.

Operates on a single route+vessel_type time series at a time (freight rate
dynamics differ meaningfully by route and vessel class, so the model is
trained on the pooled panel but every feature is computed *within* each
route/vessel group to avoid leaking one route's history into another's lags).
"""
from __future__ import annotations
import numpy as np
import pandas as pd

LAGS = [1, 7, 14, 30]
ROLLING_WINDOWS = [7, 14, 30]

FEATURE_COLUMNS = (
    [f"lag_{l}" for l in LAGS]
    + [f"rolling_mean_{w}" for w in ROLLING_WINDOWS]
    + ["rolling_std_7"]
    + ["month", "week_of_year", "quarter", "day_of_week"]
    + ["fuel_price", "fuel_price_trend_7", "demand_index", "demand_trend_7",
       "supply_index", "supply_trend_7", "port_congestion_index",
       "congestion_trend_7"]
    + ["origin_enc", "destination_enc", "vessel_type_enc", "commodity_enc"]
)

TARGET_COLUMN = "freight_rate"


def _trend(series: pd.Series, window: int = 7) -> pd.Series:
    """Simple slope-like trend: current value minus value `window` periods ago,
    normalized by the window (captures direction + speed of change)."""
    return (series - series.shift(window)) / window


def build_features(df: pd.DataFrame, group_cols=("origin", "vessel_type")) -> pd.DataFrame:
    """
    df must contain: date, origin, destination, commodity, vessel_type,
    freight_rate, fuel_price, demand_index, supply_index, port_congestion_index

    Returns a new dataframe sorted by group + date with all engineered
    features added. Rows at the start of each group's history that lack
    enough lag history will contain NaNs in the lag/rolling columns —
    callers should drop or impute these before training as appropriate.
    """
    df = df.copy().sort_values(list(group_cols) + ["date"]).reset_index(drop=True)

    grp = df.groupby(list(group_cols), sort=False)["freight_rate"]
    for l in LAGS:
        df[f"lag_{l}"] = grp.shift(l)
    for w in ROLLING_WINDOWS:
        df[f"rolling_mean_{w}"] = grp.transform(lambda s: s.shift(1).rolling(w).mean())
    df["rolling_std_7"] = grp.transform(lambda s: s.shift(1).rolling(7).std())

    # calendar features
    dt = pd.to_datetime(df["date"])
    df["month"] = dt.dt.month
    df["week_of_year"] = dt.dt.isocalendar().week.astype(int)
    df["quarter"] = dt.dt.quarter
    df["day_of_week"] = dt.dt.dayofweek

    # exogenous trend features, computed per group so trend doesn't leak across routes
    for col, out in [
        ("fuel_price", "fuel_price_trend_7"),
        ("demand_index", "demand_trend_7"),
        ("supply_index", "supply_trend_7"),
        ("port_congestion_index", "congestion_trend_7"),
    ]:
        df[out] = df.groupby(list(group_cols), sort=False)[col].transform(_trend)

    # categorical encodings (simple stable label encoding — tree models don't
    # need one-hot, and this keeps the feature set small and interpretable)
    for col in ["origin", "destination", "vessel_type", "commodity"]:
        codes, _ = pd.factorize(df[col], sort=True)
        df[f"{col}_enc"] = codes

    return df


def train_ready_frame(df_features: pd.DataFrame) -> pd.DataFrame:
    """Drop rows that don't have full lag/rolling history (can't be used for
    training since they'd have NaN inputs)."""
    required = [f"lag_{max(LAGS)}", f"rolling_mean_{max(ROLLING_WINDOWS)}"]
    return df_features.dropna(subset=required + [TARGET_COLUMN]).reset_index(drop=True)
