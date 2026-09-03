"""Small shared helpers used across routes: cached dataframe load + route listing.

Cache is intentionally short-lived (in-memory, per-process) — this is a
prototype; a production deployment would invalidate on ingestion instead.
"""
from __future__ import annotations
import time
from sqlalchemy.orm import Session

from app.services.eda import load_freight_dataframe

_cache = {"df": None, "ts": 0.0}
_TTL_SECONDS = 30


def get_freight_dataframe(db: Session, force_refresh: bool = False):
    now = time.time()
    if force_refresh or _cache["df"] is None or (now - _cache["ts"]) > _TTL_SECONDS:
        _cache["df"] = load_freight_dataframe(db)
        _cache["ts"] = now
    return _cache["df"]


def list_available_routes(db: Session):
    df = get_freight_dataframe(db)
    if df.empty:
        return []
    grouped = df.groupby(["origin", "destination", "vessel_type"]).size().reset_index(name="rows")
    return grouped.to_dict("records")
