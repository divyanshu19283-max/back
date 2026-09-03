"""East Coast India discharge-port master data.

All values are DEMO / ASSUMED reference figures (see app/data/__init__.py).
They are structurally realistic (draft/LOA limits, handling rates and
congestion levels are in the right order of magnitude for each port) but
they are NOT live data and must never be presented as such.

Units
-----
max_draft / max_loa / max_beam      : metres
berth_capacity                      : number of dry-bulk capable berths
cargo_handling_rate                 : tonnes per day (per berth, average)
max_vessel_size                     : DWT
congestion_index                    : 0-100 (see services/congestion.py)
berth_utilization                   : 0-1 fraction
turnaround_time                     : days (arrival -> departure, at berth)
anchorage_wait_time                 : days (baseline waiting at anchorage)
"""
from __future__ import annotations

DEMO_TIMESTAMP = "2026-01-01T00:00:00Z"
DEMO_SOURCE = "DEMO_ASSUMED (public port handbooks, not a live feed)"

CARGO_TYPES = ["Coal", "Iron Ore", "Grain", "Bauxite", "Fertilizer", "Limestone"]

PORTS: list[dict] = [
    {
        "id": "paradip",
        "name": "Paradip",
        "state": "Odisha",
        "latitude": 20.2648,
        "longitude": 86.6753,
        "max_draft": 18.0,
        "max_loa": 300.0,
        "max_beam": 50.0,
        "berth_capacity": 8,
        "cargo_types_supported": ["Coal", "Iron Ore", "Limestone", "Fertilizer", "Bauxite"],
        "cargo_handling_rate": 32000.0,
        "max_vessel_size": 180000.0,
        "congestion_index": 58.0,
        "berth_utilization": 0.78,
        "turnaround_time": 3.1,
        "anchorage_wait_time": 1.8,
        "restrictions": [
            "Daylight-only transit for vessels above 14.5 m draft",
            "Tidal window required for deep-draft Capesize calls",
        ],
        "operating_status": "OPERATIONAL",
    },
    {
        "id": "visakhapatnam",
        "name": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "latitude": 17.6868,
        "longitude": 83.2185,
        "max_draft": 17.0,
        "max_loa": 290.0,
        "max_beam": 48.0,
        "berth_capacity": 7,
        "cargo_types_supported": ["Coal", "Iron Ore", "Limestone", "Fertilizer", "Grain"],
        "cargo_handling_rate": 28000.0,
        "max_vessel_size": 165000.0,
        "congestion_index": 64.0,
        "berth_utilization": 0.83,
        "turnaround_time": 3.6,
        "anchorage_wait_time": 2.4,
        "restrictions": [
            "Inner harbour entrance channel restricts beam above 48 m",
            "Pilotage compulsory; night entry restricted for Capesize",
        ],
        "operating_status": "OPERATIONAL",
    },
    {
        "id": "gangavaram",
        "name": "Gangavaram",
        "state": "Andhra Pradesh",
        "latitude": 17.6167,
        "longitude": 83.2333,
        "max_draft": 21.0,
        "max_loa": 320.0,
        "max_beam": 55.0,
        "berth_capacity": 6,
        "cargo_types_supported": ["Coal", "Iron Ore", "Limestone", "Bauxite", "Fertilizer"],
        "cargo_handling_rate": 40000.0,
        "max_vessel_size": 200000.0,
        "congestion_index": 34.0,
        "berth_utilization": 0.62,
        "turnaround_time": 2.4,
        "anchorage_wait_time": 0.9,
        "restrictions": [
            "All-weather deep-draft port; no tidal restriction for Capesize",
        ],
        "operating_status": "OPERATIONAL",
    },
    {
        "id": "gopalpur",
        "name": "Gopalpur",
        "state": "Odisha",
        "latitude": 19.2667,
        "longitude": 84.9167,
        "max_draft": 13.0,
        "max_loa": 230.0,
        "max_beam": 38.0,
        "berth_capacity": 3,
        "cargo_types_supported": ["Coal", "Limestone", "Bauxite", "Fertilizer"],
        "cargo_handling_rate": 14000.0,
        "max_vessel_size": 82000.0,
        "congestion_index": 26.0,
        "berth_utilization": 0.48,
        "turnaround_time": 4.0,
        "anchorage_wait_time": 0.6,
        "restrictions": [
            "Partly lighterage-dependent for Panamax and larger parcels",
            "Monsoon (Jun-Sep) operations curtailed on exposed berths",
        ],
        "operating_status": "OPERATIONAL",
    },
    {
        "id": "dhamra",
        "name": "Dhamra",
        "state": "Odisha",
        "latitude": 20.7833,
        "longitude": 86.9833,
        "max_draft": 18.5,
        "max_loa": 300.0,
        "max_beam": 50.0,
        "berth_capacity": 4,
        "cargo_types_supported": ["Coal", "Iron Ore", "Limestone", "Fertilizer"],
        "cargo_handling_rate": 36000.0,
        "max_vessel_size": 185000.0,
        "congestion_index": 41.0,
        "berth_utilization": 0.66,
        "turnaround_time": 2.7,
        "anchorage_wait_time": 1.1,
        "restrictions": [
            "Approach channel dredged; deep-draft calls subject to survey",
        ],
        "operating_status": "OPERATIONAL",
    },
    {
        "id": "sagar_sandheads",
        "name": "Sagar / Sandheads",
        "state": "West Bengal",
        "latitude": 21.1500,
        "longitude": 88.0500,
        "max_draft": 10.5,
        "max_loa": 240.0,
        "max_beam": 40.0,
        "berth_capacity": 2,
        "cargo_types_supported": ["Coal", "Iron Ore", "Limestone", "Fertilizer", "Grain"],
        "cargo_handling_rate": 11000.0,
        "max_vessel_size": 95000.0,
        "congestion_index": 72.0,
        "berth_utilization": 0.88,
        "turnaround_time": 6.5,
        "anchorage_wait_time": 3.8,
        "restrictions": [
            "Mid-stream transhipment / lighterage anchorage, not an alongside berth",
            "Strongly tide-dependent; heavy silting reduces usable draft",
        ],
        "operating_status": "OPERATIONAL",
    },
    {
        "id": "haldia",
        "name": "Haldia",
        "state": "West Bengal",
        "latitude": 22.0333,
        "longitude": 88.0833,
        "max_draft": 8.5,
        "max_loa": 240.0,
        "max_beam": 38.0,
        "berth_capacity": 5,
        "cargo_types_supported": ["Coal", "Iron Ore", "Fertilizer", "Grain"],
        "cargo_handling_rate": 12000.0,
        "max_vessel_size": 75000.0,
        "congestion_index": 81.0,
        "berth_utilization": 0.92,
        "turnaround_time": 5.8,
        "anchorage_wait_time": 4.6,
        "restrictions": [
            "Riverine port: Hooghly channel draft limits and mandatory tidal windows",
            "Large parcels must part-discharge at Sandheads before entry",
        ],
        "operating_status": "OPERATIONAL",
    },
]

PORTS_BY_ID = {p["id"]: p for p in PORTS}
PORTS_BY_NAME = {p["name"].lower(): p for p in PORTS}


def resolve_port(identifier: str) -> dict | None:
    """Look up a port by id or (case-insensitive) name."""
    if not identifier:
        return None
    key = identifier.strip().lower().replace(" ", "_").replace("/", "_")
    if key in PORTS_BY_ID:
        return PORTS_BY_ID[key]
    return PORTS_BY_NAME.get(identifier.strip().lower())
