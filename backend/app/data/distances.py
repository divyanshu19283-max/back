"""Load-port (origin) master data and sea-distance estimation.

Origins mirror the regions already present in the freight-rate dataset
(Australia, Indonesia, South Africa, Brazil, USA Gulf) plus their
representative bulk load ports, so route analysis and forecasting speak
the same vocabulary.

Distance model (DEMO_ASSUMED, no external routing API):
    great-circle distance between load port and discharge port
      x corridor detour factor (accounts for capes, straits and traffic
        separation schemes that a rhumb line ignores)

The detour factor per corridor is documented below and returned in the
API response so the estimate is auditable.
"""
from __future__ import annotations

import math

DEMO_TIMESTAMP = "2026-01-01T00:00:00Z"
DEMO_SOURCE = "DEMO_ASSUMED (great-circle + documented corridor detour factor)"

NM_PER_KM = 0.539957

ORIGINS: list[dict] = [
    {
        "id": "australia",
        "region": "Australia",
        "load_port": "Hay Point / Newcastle (representative)",
        "latitude": -21.28,
        "longitude": 149.30,
        "detour_factor": 1.08,
        "typical_cargo": ["Coal", "Iron Ore", "Bauxite"],
        "max_draft": 18.5, "max_loa": 300.0, "max_beam": 50.0, "cargo_handling_rate": 45000.0,
    },
    {
        "id": "indonesia",
        "region": "Indonesia",
        "load_port": "Samarinda / Taboneo (representative)",
        "latitude": -3.60,
        "longitude": 114.55,
        "detour_factor": 1.12,
        "typical_cargo": ["Coal"],
        "max_draft": 16.5, "max_loa": 260.0, "max_beam": 42.0, "cargo_handling_rate": 38000.0,
    },
    {
        "id": "south_africa",
        "region": "South Africa",
        "load_port": "Richards Bay (representative)",
        "latitude": -28.80,
        "longitude": 32.05,
        "detour_factor": 1.06,
        "typical_cargo": ["Coal", "Iron Ore"],
        "max_draft": 18.0, "max_loa": 300.0, "max_beam": 48.0, "cargo_handling_rate": 42000.0,
    },
    {
        "id": "brazil",
        "region": "Brazil",
        "load_port": "Tubarao / Ponta da Madeira (representative)",
        "latitude": -20.28,
        "longitude": -40.25,
        "detour_factor": 1.15,
        "typical_cargo": ["Iron Ore", "Grain", "Bauxite"],
        "max_draft": 18.5, "max_loa": 330.0, "max_beam": 55.0, "cargo_handling_rate": 50000.0,
    },
    {
        "id": "usa_gulf",
        "region": "USA Gulf",
        "load_port": "New Orleans / Mississippi River (representative)",
        "latitude": 29.20,
        "longitude": -89.40,
        "detour_factor": 1.22,
        "typical_cargo": ["Grain", "Coal", "Fertilizer"],
        "max_draft": 15.5, "max_loa": 280.0, "max_beam": 45.0, "cargo_handling_rate": 35000.0,
    },
]

ORIGINS_BY_ID = {o["id"]: o for o in ORIGINS}
ORIGINS_BY_REGION = {o["region"].lower(): o for o in ORIGINS}


def resolve_origin(identifier: str) -> dict | None:
    if not identifier:
        return None
    key = identifier.strip().lower()
    if key in ORIGINS_BY_REGION:
        return ORIGINS_BY_REGION[key]
    return ORIGINS_BY_ID.get(key.replace(" ", "_"))


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in nautical miles."""
    r_km = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    km = 2 * r_km * math.asin(math.sqrt(a))
    return km * NM_PER_KM


def sea_distance_nm(origin: dict, port: dict) -> dict:
    """Estimated sea distance origin -> discharge port, with its provenance."""
    gc = haversine_nm(origin["latitude"], origin["longitude"], port["latitude"], port["longitude"])
    factor = origin.get("detour_factor", 1.10)
    return {
        "great_circle_nm": round(gc, 1),
        "detour_factor": factor,
        "distance_nm": round(gc * factor, 1),
        "method": "great-circle x corridor detour factor",
        "data_source": DEMO_SOURCE,
        "data_timestamp": DEMO_TIMESTAMP,
    }
