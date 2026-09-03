"""Access layer for port / vessel / origin master data.

Seeds the `ports` and `vessels` tables from the static catalogs on startup
(idempotent upsert) and reads back through the DB when a session is
available, falling back to the static catalog otherwise. This keeps the
data layer real (queryable, overridable per deployment) while guaranteeing
the API always has master data to answer with.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.data import ports as ports_data
from app.data import vessels as vessels_data
from app.data import distances as distances_data
from app.models.maritime import Port, Vessel

_LIST_FIELDS_PORT = ("cargo_types_supported", "restrictions")
_LIST_FIELDS_VESSEL = ("cargo_types",)


def _encode(record: dict, list_fields: tuple[str, ...]) -> dict:
    out = dict(record)
    for f in list_fields:
        out[f] = json.dumps(out.get(f, []))
    return out


def _decode(row, list_fields: tuple[str, ...]) -> dict:
    out = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    for f in list_fields:
        try:
            out[f] = json.loads(out[f])
        except (TypeError, ValueError):
            out[f] = []
    out.pop("updated_at", None)
    return out


def seed_reference_data(db: Session) -> dict:
    """Insert-or-update the port/vessel master rows. Safe to call repeatedly."""
    now = datetime.now(timezone.utc)
    ports_written = vessels_written = 0

    for record in ports_data.PORTS:
        payload = _encode(record, _LIST_FIELDS_PORT)
        payload["data_source"] = ports_data.DEMO_SOURCE
        payload["data_timestamp"] = ports_data.DEMO_TIMESTAMP
        row = db.get(Port, record["id"])
        if row is None:
            db.add(Port(**payload, updated_at=now))
        else:
            for k, v in payload.items():
                setattr(row, k, v)
            row.updated_at = now
        ports_written += 1

    for record in vessels_data.VESSELS:
        payload = _encode(record, _LIST_FIELDS_VESSEL)
        payload["data_source"] = vessels_data.DEMO_SOURCE
        payload["data_timestamp"] = vessels_data.DEMO_TIMESTAMP
        row = db.get(Vessel, record["id"])
        if row is None:
            db.add(Vessel(**payload, updated_at=now))
        else:
            for k, v in payload.items():
                setattr(row, k, v)
            row.updated_at = now
        vessels_written += 1

    db.commit()
    return {"ports_seeded": ports_written, "vessels_seeded": vessels_written}


# --------------------------------------------------------------------------
# Read helpers — DB first, static catalog as fallback
# --------------------------------------------------------------------------

def _static_port(record: dict) -> dict:
    out = dict(record)
    out["data_source"] = ports_data.DEMO_SOURCE
    out["data_timestamp"] = ports_data.DEMO_TIMESTAMP
    return out


def _static_vessel(record: dict) -> dict:
    out = dict(record)
    out["data_source"] = vessels_data.DEMO_SOURCE
    out["data_timestamp"] = vessels_data.DEMO_TIMESTAMP
    return out


def list_ports(db: Optional[Session] = None) -> list[dict]:
    if db is not None:
        try:
            rows = db.execute(select(Port).order_by(Port.name)).scalars().all()
            if rows:
                return [_decode(r, _LIST_FIELDS_PORT) for r in rows]
        except SQLAlchemyError:
            # Reference tables are convenience master-data storage; the
            # canonical static catalog remains available if a fresh/local DB
            # has not created these tables yet.
            db.rollback()
    return [_static_port(p) for p in ports_data.PORTS]


def get_port(identifier: str, db: Optional[Session] = None) -> Optional[dict]:
    if db is not None:
        try:
            row = db.get(Port, (identifier or "").strip().lower().replace(" ", "_").replace("/", "_"))
            if row is not None:
                return _decode(row, _LIST_FIELDS_PORT)
        except SQLAlchemyError:
            db.rollback()
    record = ports_data.resolve_port(identifier)
    return _static_port(record) if record else None


def list_vessels(db: Optional[Session] = None) -> list[dict]:
    if db is not None:
        try:
            rows = db.execute(select(Vessel).order_by(Vessel.dwt)).scalars().all()
            if rows:
                return [_decode(r, _LIST_FIELDS_VESSEL) for r in rows]
        except SQLAlchemyError:
            db.rollback()
    return [_static_vessel(v) for v in vessels_data.VESSELS]


def get_vessel(identifier: str, db: Optional[Session] = None) -> Optional[dict]:
    record = vessels_data.resolve_vessel(identifier)
    if record is None:
        return None
    if db is not None:
        try:
            row = db.get(Vessel, record["id"])
            if row is not None:
                return _decode(row, _LIST_FIELDS_VESSEL)
        except SQLAlchemyError:
            db.rollback()
    return _static_vessel(record)


def list_origins() -> list[dict]:
    return [
        {**o, "data_source": distances_data.DEMO_SOURCE,
         "data_timestamp": distances_data.DEMO_TIMESTAMP}
        for o in distances_data.ORIGINS
    ]


def get_origin(identifier: str) -> Optional[dict]:
    return distances_data.resolve_origin(identifier)
