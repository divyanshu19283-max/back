"""Port congestion engine.

Congestion index bands (problem statement section 5):

    0-30   LOW
    31-60  MODERATE
    61-80  HIGH
    81-100 CRITICAL

From the index (and the port's baseline anchorage wait / berth utilisation)
we derive the operational and financial consequences that feed voyage
economics, idle-time optimisation and risk scoring:

    waiting_time_days      baseline anchorage wait scaled by congestion
    congestion_delay_days  extra days on top of the uncongested baseline
    berth_utilization      queueing pressure (>0.85 = queue builds fast)
    additional_idle_days   delay the charterer actually pays for
    congestion_cost_usd    additional_idle_days x (charter + opex) [+ demurrage]

Scaling model (DEMO_ASSUMED, documented, no live feed): waiting time grows
super-linearly with utilisation, mirroring M/M/c queueing behaviour where
the queue explodes as utilisation approaches 1.
"""
from __future__ import annotations

BANDS = (
    (30.0, "LOW"),
    (60.0, "MODERATE"),
    (80.0, "HIGH"),
    (100.0, "CRITICAL"),
)

# Multiplier applied to the port's baseline anchorage wait, by band.
BAND_WAIT_MULTIPLIER = {"LOW": 0.6, "MODERATE": 1.0, "HIGH": 1.6, "CRITICAL": 2.4}

# Fraction of congestion delay that is commercially "idle" for the charterer
# (some waiting is absorbed by laytime / scheduling slack).
IDLE_ABSORPTION = {"LOW": 0.3, "MODERATE": 0.5, "HIGH": 0.75, "CRITICAL": 0.9}

UNCONGESTED_INDEX = 25.0  # reference index treated as "no congestion penalty"


def classify(congestion_index: float) -> str:
    idx = max(0.0, min(100.0, float(congestion_index)))
    for ceiling, label in BANDS:
        if idx <= ceiling:
            return label
    return "CRITICAL"


def queue_factor(berth_utilization: float) -> float:
    """Super-linear queueing multiplier from berth utilisation (0-1)."""
    u = max(0.0, min(0.98, float(berth_utilization)))
    return round(1.0 / (1.0 - u), 3)




def assess_port_congestion(
    port: dict,
    vessel: dict | None = None,
    demurrage_rate_per_day: float = 0.0,
) -> dict:
    """Full congestion assessment for a port (optionally costed for a vessel)."""
    idx = float(port["congestion_index"])
    band = classify(idx)
    baseline_wait = float(port["anchorage_wait_time"])
    utilization = float(port["berth_utilization"])

    waiting_time = baseline_wait * BAND_WAIT_MULTIPLIER[band] * min(queue_factor(utilization) / 2.5, 2.0)
    uncongested_wait = baseline_wait * BAND_WAIT_MULTIPLIER["LOW"]
    congestion_delay = max(0.0, waiting_time - uncongested_wait)
    additional_idle = congestion_delay * IDLE_ABSORPTION[band]

    daily_cost = 0.0
    if vessel is not None:
        daily_cost = float(vessel["daily_charter_rate"]) + float(vessel["daily_opex"])
    daily_cost += float(demurrage_rate_per_day or 0.0)
    congestion_cost = additional_idle * daily_cost

    return {
        "port_id": port["id"],
        "port_name": port["name"],
        "congestion_index": round(idx, 1),
        "congestion_level": band,
        "berth_utilization": round(utilization, 3),
        "queue_factor": queue_factor(utilization),
        "waiting_time_days": round(waiting_time, 2),
        "uncongested_wait_days": round(uncongested_wait, 2),
        "congestion_delay_days": round(congestion_delay, 2),
        "additional_idle_days": round(additional_idle, 2),
        "daily_cost_basis_usd": round(daily_cost, 2),
        "congestion_cost_usd": round(congestion_cost, 2),
        "reference_index_uncongested": UNCONGESTED_INDEX,
        "data_source": port.get("data_source"),
        "data_timestamp": port.get("data_timestamp"),
        "assumptions": (
            "Waiting time = baseline anchorage wait x band multiplier x capped "
            "queueing factor 1/(1-utilisation). Band multipliers and idle "
            "absorption ratios are documented modelling assumptions (DEMO), "
            "not live port authority data."
        ),
    }
