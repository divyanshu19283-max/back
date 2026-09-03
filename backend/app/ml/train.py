"""
Forecasting model training pipeline.

Design choices:
  - Direct multi-horizon forecasting: a separate model is trained per horizon
    (7 / 30 / 90 days), where the target is freight_rate shifted -horizon
    days within each route+vessel_type group, and features are everything
    known at time t (lags, rolling stats, calendar, exogenous trends).
    This avoids compounding recursive-forecast error, which matters more
    than the small extra training cost here.
  - Time-aware split: NEVER shuffle. The most recent `VALIDATION_FRACTION`
    of each group's chronological history is held out for validation.
  - Baselines (naive persistence, moving average) are evaluated on the same
    split for an honest "are the ML models actually better than doing
    nothing clever" sanity check — required by the problem statement.
  - Best model chosen by validation RMSE (ties broken by MAPE).
"""
from __future__ import annotations
import json
import os
from dataclasses import dataclass, asdict
from datetime import date as date_type
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False

from app.ml.features import build_features, train_ready_frame, FEATURE_COLUMNS

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data", "trained_models",
)
HORIZONS = [7, 30, 90]
VALIDATION_FRACTION = 0.15
GROUP_COLS = ["origin", "vessel_type"]


@dataclass
class EvalMetrics:
    model_name: str
    mae: float
    rmse: float
    mape: float
    r2: Optional[float]
    n_val: int

    def as_dict(self):
        return asdict(self)


def mape(y_true, y_pred) -> float:
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = y_true != 0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def evaluate(name: str, y_true, y_pred) -> EvalMetrics:
    return EvalMetrics(
        model_name=name,
        mae=round(float(mean_absolute_error(y_true, y_pred)), 4),
        rmse=round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        mape=round(mape(y_true, y_pred), 4),
        r2=round(float(r2_score(y_true, y_pred)), 4) if len(set(np.round(y_true, 6))) > 1 else None,
        n_val=len(y_true),
    )


def make_horizon_dataset(df_raw: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Builds features on df_raw, then attaches a future target (freight_rate
    `horizon` days ahead within each group)."""
    feat = build_features(df_raw, group_cols=GROUP_COLS)
    feat["target"] = feat.groupby(GROUP_COLS, sort=False)["freight_rate"].shift(-horizon)
    # drop rows missing full lag/rolling history or missing forward target
    feat = feat.dropna(subset=[f"lag_30", "rolling_mean_30", "target"]).reset_index(drop=True)
    return feat


def time_aware_split(df: pd.DataFrame, val_fraction: float = VALIDATION_FRACTION):
    """Split chronologically WITHIN each group, then concatenate. No shuffling."""
    train_parts, val_parts = [], []
    for _, g in df.groupby(GROUP_COLS, sort=False):
        g = g.sort_values("date")
        n_val = max(1, int(len(g) * val_fraction))
        train_parts.append(g.iloc[:-n_val])
        val_parts.append(g.iloc[-n_val:])
    train_df = pd.concat(train_parts).sort_values("date").reset_index(drop=True)
    val_df = pd.concat(val_parts).sort_values("date").reset_index(drop=True)
    return train_df, val_df


def train_horizon_model(df_raw: pd.DataFrame, horizon: int, verbose: bool = True) -> dict:
    data = make_horizon_dataset(df_raw, horizon)
    train_df, val_df = time_aware_split(data)

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df["target"]
    X_val, y_val = val_df[FEATURE_COLUMNS], val_df["target"]

    results = {}

    # --- Baselines ---
    # Naive persistence: predict current rate stays the same at t+horizon
    naive_pred = val_df["lag_1"]
    results["naive_persistence"] = (evaluate("naive_persistence", y_val, naive_pred), None)

    # Moving average: predict the trailing 7-day mean continues
    ma_pred = val_df["rolling_mean_7"]
    results["moving_average_7"] = (evaluate("moving_average_7", y_val, ma_pred), None)

    # --- ML models ---
    rf = RandomForestRegressor(
        n_estimators=300, max_depth=12, min_samples_leaf=3,
        n_jobs=-1, random_state=42,
    )
    rf.fit(X_train, y_train)
    results["random_forest"] = (evaluate("random_forest", y_val, rf.predict(X_val)), rf)

    gbr = GradientBoostingRegressor(
        n_estimators=300, max_depth=3, learning_rate=0.05, random_state=42,
    )
    gbr.fit(X_train, y_train)
    results["gradient_boosting"] = (evaluate("gradient_boosting", y_val, gbr.predict(X_val)), gbr)

    if HAS_XGB:
        xgbm = xgb.XGBRegressor(
            n_estimators=400, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42,
            n_jobs=-1, objective="reg:squarederror",
        )
        xgbm.fit(X_train, y_train)
        results["xgboost"] = (evaluate("xgboost", y_val, xgbm.predict(X_val)), xgbm)

    if HAS_LGB:
        lgbm = lgb.LGBMRegressor(
            n_estimators=400, max_depth=-1, num_leaves=31, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1,
            verbosity=-1,
        )
        lgbm.fit(X_train, y_train)
        results["lightgbm"] = (evaluate("lightgbm", y_val, lgbm.predict(X_val)), lgbm)

    # --- pick the best model by validation RMSE (must be one of the ML models,
    # not a baseline — baselines are for the sanity-check comparison table) ---
    ml_candidates = {
        k: v for k, v in results.items()
        if k not in ("naive_persistence", "moving_average_7")
    }
    best_name = min(ml_candidates, key=lambda k: ml_candidates[k][0].rmse)
    best_metrics, best_model = ml_candidates[best_name]

    # residual-based confidence interval: std of validation residuals for the
    # winning model, used later to build lower/upper bounds at inference time
    val_pred_best = best_model.predict(X_val)
    residuals = (y_val.values - val_pred_best)
    residual_std = float(np.std(residuals))
    residual_mape = best_metrics.mape

    if verbose:
        print(f"\n=== Horizon {horizon}d — validation results ===")
        for name, (m, _) in results.items():
            print(f"  {name:22s} MAE={m.mae:8.3f}  RMSE={m.rmse:8.3f}  MAPE={m.mape:7.3f}%  R2={m.r2}")
        print(f"  -> BEST: {best_name} (rmse={best_metrics.rmse})")

    # persist model + metadata
    os.makedirs(MODEL_DIR, exist_ok=True)
    model_path = os.path.join(MODEL_DIR, f"model_h{horizon}.joblib")
    joblib.dump({"model": best_model, "model_name": best_name, "feature_columns": FEATURE_COLUMNS}, model_path)

    meta = {
        "horizon": horizon,
        "best_model": best_name,
        "residual_std": residual_std,
        "residual_mape": residual_mape,
        "training_rows": int(len(train_df)),
        "validation_rows": int(len(val_df)),
        "training_start": str(train_df["date"].min().date() if hasattr(train_df["date"].min(), "date") else train_df["date"].min()),
        "training_end": str(train_df["date"].max().date() if hasattr(train_df["date"].max(), "date") else train_df["date"].max()),
        "leaderboard": {k: v[0].as_dict() for k, v in results.items()},
        "feature_importances": (
            dict(sorted(
                zip(FEATURE_COLUMNS, getattr(best_model, "feature_importances_", [0] * len(FEATURE_COLUMNS))),
                key=lambda kv: -kv[1],
            ))
            if hasattr(best_model, "feature_importances_") else None
        ),
    }
    meta_path = os.path.join(MODEL_DIR, f"model_h{horizon}_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2, default=float)

    return meta


def train_all_horizons(df_raw: pd.DataFrame) -> dict:
    return {h: train_horizon_model(df_raw, h) for h in HORIZONS}


if __name__ == "__main__":
    from app.database import SessionLocal
    from app.services.eda import load_freight_dataframe

    db = SessionLocal()
    try:
        df_raw = load_freight_dataframe(db)
    finally:
        db.close()

    print(f"Loaded {len(df_raw):,} rows from DB for training.")
    all_meta = train_all_horizons(df_raw)
    print("\nAll horizons trained. Summary:")
    for h, m in all_meta.items():
        print(f"  horizon={h}d best_model={m['best_model']} "
              f"rmse={m['leaderboard'][m['best_model']]['rmse']} "
              f"mape={m['leaderboard'][m['best_model']]['mape']}%")
