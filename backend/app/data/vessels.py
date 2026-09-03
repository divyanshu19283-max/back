"""Dry-bulk vessel class master data.

DEMO / ASSUMED class-representative figures (see app/data/__init__.py).
These describe a *typical* modern vessel of each class, used for
feasibility screening and voyage economics.

Units
-----
dwt / cargo_capacity   : tonnes
loa / beam / draft     : metres (draft = summer laden draft)
fuel_consumption       : tonnes of bunker fuel per day at laden speed
speed                  : knots (service speed)
daily_opex             : USD/day (crew, stores, insurance, maintenance)
daily_charter_rate     : USD/day (indicative time-charter equivalent)
loading_rate           : tonnes/day the vessel's gear/holds can sustain
discharge_rate         : tonnes/day the vessel's gear/holds can sustain
emissions_factor       : tonnes CO2 per tonne of bunker fuel burned
"""
from __future__ import annotations

DEMO_TIMESTAMP = "2026-01-01T00:00:00Z"
DEMO_SOURCE = "DEMO_ASSUMED (class-representative figures, not a live feed)"

VESSELS: list[dict] = [
    {
        "id": "handysize",
        "vessel_type": "Handysize",
        "dwt": 32000.0,
        "loa": 180.0,
        "beam": 28.0,
        "draft": 10.0,
        "cargo_capacity": 30000.0,
        "cargo_types": ["Coal", "Grain", "Fertilizer", "Bauxite", "Limestone"],
        "fuel_consumption": 18.0,
        "speed": 13.0,
        "daily_opex": 5200.0,
        "daily_charter_rate": 11000.0,
        "loading_rate": 9000.0,
        "discharge_rate": 8000.0,
        "ballast_speed": 13.5,
        "laden_speed": 12.5,
        "emissions_factor": 3.114,
    },
    {
        "id": "supramax",
        "vessel_type": "Supramax",
        "dwt": 58000.0,
        "loa": 190.0,
        "beam": 32.3,
        "draft": 12.8,
        "cargo_capacity": 55000.0,
        "cargo_types": ["Coal", "Iron Ore", "Grain", "Fertilizer", "Bauxite", "Limestone"],
        "fuel_consumption": 26.0,
        "speed": 14.0,
        "daily_opex": 6000.0,
        "daily_charter_rate": 15500.0,
        "loading_rate": 16000.0,
        "discharge_rate": 14000.0,
        "ballast_speed": 14.5,
        "laden_speed": 13.5,
        "emissions_factor": 3.114,
    },
    {
        "id": "panamax",
        "vessel_type": "Panamax",
        "dwt": 76000.0,
        "loa": 229.0,
        "beam": 32.3,
        "draft": 14.2,
        "cargo_capacity": 72000.0,
        "cargo_types": ["Coal", "Iron Ore", "Grain", "Bauxite", "Limestone"],
        "fuel_consumption": 32.0,
        "speed": 14.0,
        "daily_opex": 6600.0,
        "daily_charter_rate": 18500.0,
        "loading_rate": 24000.0,
        "discharge_rate": 20000.0,
        "ballast_speed": 14.5,
        "laden_speed": 13.5,
        "emissions_factor": 3.114,
    },
    {
        "id": "capesize",
        "vessel_type": "Capesize",
        "dwt": 180000.0,
        "loa": 292.0,
        "beam": 45.0,
        "draft": 18.2,
        "cargo_capacity": 172000.0,
        "cargo_types": ["Coal", "Iron Ore", "Bauxite", "Limestone"],
        "fuel_consumption": 48.0,
        "speed": 14.5,
        "daily_opex": 8200.0,
        "daily_charter_rate": 27000.0,
        "loading_rate": 45000.0,
        "discharge_rate": 38000.0,
        "ballast_speed": 15.0,
        "laden_speed": 14.0,
        "emissions_factor": 3.114,
    },
]

VESSELS_BY_ID = {v["id"]: v for v in VESSELS}
VESSELS_BY_TYPE = {v["vessel_type"].lower(): v for v in VESSELS}

# Legacy dataset label ("Bulk Carrier" appears in the historical/synthetic
# freight-rate data) mapped onto the closest master class.
LEGACY_TYPE_ALIASES = {
    "bulk carrier": "supramax",
    "handy": "handysize",
    "handymax": "supramax",
    "kamsarmax": "panamax",
    "cape": "capesize",
}


def resolve_vessel(identifier: str) -> dict | None:
    """Look up a vessel class by id, vessel_type or a known legacy alias."""
    if not identifier:
        return None
    key = identifier.strip().lower()
    if key in VESSELS_BY_ID:
        return VESSELS_BY_ID[key]
    if key in VESSELS_BY_TYPE:
        return VESSELS_BY_TYPE[key]
    alias = LEGACY_TYPE_ALIASES.get(key)
    return VESSELS_BY_ID.get(alias) if alias else None
