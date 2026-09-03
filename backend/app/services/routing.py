"""Route analysis service (problem statement section 4).

Origin (load region/port) -> destination (East Coast India port) -> vessel.

Produces the full voyage time budget:

    distance, sailing (laden) time, ballast time, loading time,
    discharge time, port waiting time, congestion delay, total duration

An infeasible vessel is never returned as a recommendation: the route
analysis carries the feasibility verdict and refuses to produce a
schedule when the hard checks fail.
"""
from __future__ import annotations

from app.data.distances import sea_distance_nm
from app.services.congestion import assess_port_congestion
from app.services.feasibility import (
    check_feasibility,
    effective_discharge_rate,
    effective_loading_rate,
)

HOURS_PER_DAY = 24.0
# Fraction of the laden distance a vessel typically steams in ballast to reach
# the load port for the next fixture (DEMO_ASSUMED positioning allowance).
BALLAST_DISTANCE_RATIO = 0.35
PORT_TURN_OVERHEAD_DAYS = 0.5  # pilotage, berthing, surveys, documentation


class InfeasibleRouteError(ValueError):
    """Raised when the requested vessel cannot call at the requested port."""


def steaming_days(distance_nm: float, speed_knots: float) -> float:
    if speed_knots <= 0:
        raise ValueError("Vessel speed must be positive.")
    return distance_nm / (speed_knots * HOURS_PER_DAY)


def analyze_route(
    origin: dict,
    port: dict,
    vessel: dict,
    cargo_quantity: float,
    cargo_type: str | None = None,
    include_ballast: bool = True,
    demurrage_rate_per_day: float = 0.0,
    strict: bool = True,
) -> dict:
    feasibility = check_feasibility(port, vessel, cargo_type, cargo_quantity)
    if strict and feasibility["status"] == "NOT_FEASIBLE":
        raise InfeasibleRouteError("; ".join(feasibility["reasons"]))

    dist = sea_distance_nm(origin, port)
    laden_days = steaming_days(dist["distance_nm"], float(vessel["laden_speed"]))
    ballast_days = (
        steaming_days(dist["distance_nm"] * BALLAST_DISTANCE_RATIO, float(vessel["ballast_speed"]))
        if include_ballast else 0.0
    )

    load_rate = effective_loading_rate(port, vessel)
    disch_rate = effective_discharge_rate(port, vessel)
    loading_days = cargo_quantity / load_rate if load_rate > 0 else 0.0
    discharge_days = cargo_quantity / disch_rate if disch_rate > 0 else 0.0

    congestion = assess_port_congestion(port, vessel, demurrage_rate_per_day)
    waiting_days = congestion["waiting_time_days"]
    congestion_delay = congestion["congestion_delay_days"]

    total_days = (
        laden_days + ballast_days + loading_days + discharge_days
        + waiting_days + 2 * PORT_TURN_OVERHEAD_DAYS
    )

    return {
        "origin": {"id": origin["id"], "region": origin["region"], "load_port": origin["load_port"]},
        "destination_port": {"id": port["id"], "name": port["name"], "state": port["state"]},
        "vessel": {"id": vessel["id"], "vessel_type": vessel["vessel_type"], "dwt": vessel["dwt"]},
        "cargo_type": cargo_type,
        "cargo_quantity": cargo_quantity,
        "feasibility": feasibility,
        "distance": dist,
        "duration_days": {
            "sailing_laden": round(laden_days, 2),
            "ballast": round(ballast_days, 2),
            "loading": round(loading_days, 2),
            "discharge": round(discharge_days, 2),
            "port_waiting": round(waiting_days, 2),
            "congestion_delay": round(congestion_delay, 2),
            "port_turn_overhead": round(2 * PORT_TURN_OVERHEAD_DAYS, 2),
            "total_voyage_duration": round(total_days, 2),
        },
        "congestion": congestion,
        "assumptions": {
            "ballast_distance_ratio": BALLAST_DISTANCE_RATIO,
            "port_turn_overhead_days_per_call": PORT_TURN_OVERHEAD_DAYS,
            "note": "Distances and time allowances are DEMO_ASSUMED modelling "
                    "values computed locally; no external routing/AIS API is used.",
        },
    }
