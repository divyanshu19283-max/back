"""
Inference service.

Loads the joblib-persisted model for a given horizon, builds the same
feature set used at training time from the most recent history for a
route+vessel_type, and returns a forecast with a residual-based confidence
interval — never just a single point estimate (per problem statement req 6).
"""
from __future__ import annotations
import json
import os
from datetime import timedelta
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from app.ml.features import build_features, FEATURE_COLUMNS
from app.ml.train import MODEL_DIR, HORIZONS, GROUP_COLS

Z_80 = 1.2816  # ~80% two-sided CI multiplier on residual std

# A single /api/whatif or /api/maritime/integrated-decision request calls
# forecast_route() several times (once directly, plus once per horizon
# inside optimize_procurement's charter-now/wait-N-days loop). Each call
# needs build_features() run over the FULL pooled history (see comment
# below), which is the same input dataframe within one request — and
# usually within the same 30s data_access.py cache window across requests
# too. Cache the built-features frame by the input dataframe's identity so
# repeat calls in one request (or within the TTL) don't redo the full
# groupby/factorize pass every time. Bounded to a couple of entries since
# only the current cached dataframe (and briefly its predecessor, right
# after a refresh) are ever relevant.
_feat_cache: dict[int, tuple[int, "pd.DataFrame"]] = {}
_FEAT_CACHE_MAX = 2


def _build_features_cached(df_history: pd.DataFrame, group_cols) -> pd.DataFrame:
    key = id(df_history)
    cached = _feat_cache.get(key)
    if cached is not None and cached[0] == len(df_history):
        return cached[1]
    feat_full = build_features(df_history, group_cols=group_cols)
    if len(_feat_cache) >= _FEAT_CACHE_MAX:
        _feat_cache.pop(next(iter(_feat_cache)))
    _feat_cache[key] = (len(df_history), feat_full)
    return feat_full


class ModelNotTrainedError(RuntimeError):
    pass


class ModelLoadError(RuntimeError):
    """A trained model file exists but couldn't be unpickled — e.g. it was
    trained under a different scikit-learn/xgboost/lightgbm version than is
    installed now, which surfaces as ModuleNotFoundError / AttributeError
    on internals like `sklearn.ensemble._gb_losses` or `_loss` that moved
    or were renamed between versions. This is distinct from "never trained"
    so callers/logs can tell the two apart."""
    pass


def _retrain_horizon(horizon: int) -> None:
    """Regenerate data/trained_models/model_h{horizon}.joblib from whatever
    freight history is currently in the DB. Used as a one-shot self-heal
    when the committed model artifact fails to unpickle in this environment
    (version-mismatched joblib/sklearn build), so a stale or incompatible
    file on disk can never turn into a hard crash in production — worst
    case we just retrain locally against the same data the app already
    seeded itself."""
    from app.database import SessionLocal
    from app.services.data_access import get_freight_dataframe
    from app.ml.train import train_horizon_model

    db = SessionLocal()
    try:
        df_raw = get_freight_dataframe(db, force_refresh=True)
    finally:
        db.close()

    if df_raw is None or df_raw.empty:
        raise ModelNotTrainedError(
            f"No trained model for horizon={horizon}, and no data available "
            f"to retrain one. Ingest or seed data first."
        )

    train_horizon_model(df_raw, horizon, verbose=False)


@lru_cache(maxsize=8)
def _load_model_bundle(horizon: int):
    path = os.path.join(MODEL_DIR, f"model_h{horizon}.joblib")
    meta_path = os.path.join(MODEL_DIR, f"model_h{horizon}_meta.json")

    def _read():
        bundle = joblib.load(path)
        with open(meta_path) as f:
            meta = json.load(f)
        return bundle, meta

    if not os.path.exists(path):
        raise ModelNotTrainedError(
            f"No trained model for horizon={horizon}. Run `python -m app.ml.train` first."
        )

    try:
        return _read()
    except ModelNotTrainedError:
        raise
    except Exception as e:
        # Covers joblib/pickle incompatibilities across sklearn/xgboost/
        # lightgbm versions (ModuleNotFoundError, AttributeError on renamed
        # internals like `_loss`, unpickling errors, etc.) — self-heal by
        # retraining once from live data rather than crashing the request.
        import logging
        logging.getLogger(__name__).warning(
            "Model h%s failed to load (%s: %s) — retraining from current data instead.",
            horizon, type(e).__name__, e,
        )
        try:
            _retrain_horizon(horizon)
        except ModelNotTrainedError:
            raise
        except Exception as retrain_err:
            raise ModelLoadError(
                f"Model h{horizon} failed to load ({type(e).__name__}) and "
                f"automatic retraining also failed ({type(retrain_err).__name__}: "
                f"{retrain_err}). This usually means the committed model file "
                f"was trained under a different scikit-learn/xgboost/lightgbm "
                f"version than is installed here — pin matching versions and "
                f"redeploy, or run `python -m app.ml.train` to regenerate it."
            ) from retrain_err

        try:
            return _read()
        except Exception as reload_err:
            raise ModelLoadError(
                f"Model h{horizon} was retrained but still failed to load "
                f"({type(reload_err).__name__}: {reload_err})."
            ) from reload_err


def nearest_supported_horizon(days: int) -> int:
    return min(HORIZONS, key=lambda h: abs(h - days))


def confidence_score_from_mape(mape_pct: float) -> float:
    """Map validation MAPE to a 0-1 confidence score. This is an explicit,
    documented heuristic (not a statistical guarantee): lower MAPE -> higher
    confidence, saturating between 50% (very noisy) and 97% (very tight)."""
    score = 1.0 - (mape_pct / 25.0)  # 25% MAPE ~ floor
    return float(np.clip(score, 0.50, 0.97))


def forecast_route(
    df_history: pd.DataFrame,
    origin: str,
    destination: str,
    vessel_type: str,
    horizon_days: int = 7,
) -> dict:
    """
    df_history: the full freight_rates dataframe (all routes) so lag/rolling
    features can be computed correctly for the requested route's most recent
    window.
    """
    horizon = nearest_supported_horizon(horizon_days)
    bundle, meta = _load_model_bundle(horizon)
    model, feature_cols = bundle["model"], bundle["feature_columns"]

    # Match case- and whitespace-insensitively: the frontend, demo fallback
    # data, and user-typed values aren't guaranteed to match the exact
    # casing stored in the DB (e.g. "AUSTRALIA" vs "Australia"), and an
    # exact `==` comparison here was silently returning zero rows for any
    # such mismatch, surfacing as a 400 "no historical data" error even
    # though the route genuinely exists.
    origin_norm = str(origin).strip().casefold()
    destination_norm = str(destination).strip().casefold()
    vessel_type_norm = str(vessel_type).strip().casefold()

    route_hist = df_history[
        (df_history["origin"].str.strip().str.casefold() == origin_norm)
        & (df_history["destination"].str.strip().str.casefold() == destination_norm)
        & (df_history["vessel_type"].str.strip().str.casefold() == vessel_type_norm)
    ].sort_values("date")

    if route_hist.empty:
        available = sorted(set(
            f"{o} -> {d} ({v})"
            for o, d, v in df_history[["origin", "destination", "vessel_type"]]
                .drop_duplicates().itertuples(index=False)
        ))
        raise ValueError(
            f"No historical data for {origin!r} -> {destination!r} ({vessel_type!r}) "
            f"after normalizing to origin={origin_norm!r}, destination={destination_norm!r}, "
            f"vessel_type={vessel_type_norm!r}. "
            f"{len(available)} route/vessel combinations exist in the loaded data"
            + (f", including: {', '.join(available[:8])}"
               + ("..." if len(available) > 8 else "") if available else " (the loaded dataframe is empty)")
        )

    # Use the canonical casing as actually stored in the data for the
    # response, rather than echoing back whatever casing the caller sent.
    origin = route_hist["origin"].iloc[-1]
    destination = route_hist["destination"].iloc[-1]
    vessel_type = route_hist["vessel_type"].iloc[-1]

    # Build features over the FULL pooled history (all routes), exactly as
    # app/ml/train.py does, then select this route's rows — not just this
    # route's slice. The categorical encodings (origin_enc, destination_enc,
    # vessel_type_enc, commodity_enc) are computed via pd.factorize() over
    # whatever frame is passed in; factorizing a frame that's already been
    # filtered down to a single origin/destination/vessel_type would give
    # every one of those columns the constant code 0 regardless of which
    # route it actually is — a train/inference skew (the trained model
    # learned real, route-varying codes). Lag/rolling features are computed
    # per (origin, vessel_type) group either way, so they're identical
    # whether we filter before or after — only the categorical codes are
    # affected, and only the full-history call reproduces training exactly.
    feat_full = _build_features_cached(df_history, GROUP_COLS)
    route_mask = (
        (feat_full["origin"].str.strip().str.casefold() == origin_norm)
        & (feat_full["destination"].str.strip().str.casefold() == destination_norm)
        & (feat_full["vessel_type"].str.strip().str.casefold() == vessel_type_norm)
    )
    feat = feat_full[route_mask].sort_values("date")
    latest_row = feat.dropna(subset=feature_cols).tail(1)
    if latest_row.empty:
        nan_cols = [c for c in feature_cols if feat[c].isna().all()]
        raise ValueError(
            f"Not enough history to compute lag/rolling features for "
            f"{origin} -> {destination} ({vessel_type}): {len(route_hist)} rows found "
            f"(need enough for the largest lag/window). "
            + (f"Columns entirely NaN: {nan_cols}." if nan_cols else
               "Most recent row(s) still have NaN in at least one lag/rolling column "
               "— likely a short/recent history for this route.")
        )

    X = latest_row[feature_cols]
    point_pred = float(model.predict(X)[0])

    residual_std = meta["residual_std"]
    lower = point_pred - Z_80 * residual_std
    upper = point_pred + Z_80 * residual_std
    confidence = confidence_score_from_mape(meta["residual_mape"])

    last_date = pd.to_datetime(route_hist["date"]).max()
    forecast_date = (last_date + timedelta(days=horizon_days)).date()

    return {
        "origin": origin,
        "destination": destination,
        "vessel_type": vessel_type,
        "horizon_days": horizon_days,
        "model_horizon_used": horizon,
        "forecast_date": str(forecast_date),
        "predicted_rate": round(point_pred, 2),
        "lower_bound": round(max(0.0, lower), 2),
        "upper_bound": round(upper, 2),
        "confidence_score": round(confidence, 3),
        "model_name": meta["best_model"],
        "current_rate": round(float(route_hist["freight_rate"].iloc[-1]), 2),
        "as_of_date": str(last_date.date()),
    }
