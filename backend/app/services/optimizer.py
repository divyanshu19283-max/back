"""
Procurement optimizer.

Compares chartering now vs. waiting 7 / 30 / 90 days, folding in freight
cost, an estimated fuel cost, and a risk adjustment for forecast
uncertainty, then recommends the lowest total-estimated-cost option.

Fuel cost model: freight fuel consumption doesn't come from a live API
(explicitly out of scope), so we use a documented per-vessel-type fuel
intensity assumption (tons of bunker fuel per ton of cargo carried,
reflecting economies of scale on larger hulls). This is clearly labelled
as an assumption, not measured data.

Risk adjustment: (1 - confidence_score) x freight_cost x RISK_WEIGHT — a
low-confidence forecast gets an explicit uncertainty penalty added to its
total cost, so the optimizer doesn't chase a shaky low prediction purely
on point-estimate value.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Optional

from app.ml.predict import forecast_route

FUEL_INTENSITY_TONS_PER_CARGO_TON = {
    # documented assumption, not measured — tons bunker fuel / ton cargo
    "Capesize": 0.0080,
    "Panamax": 0.0100,
    "Bulk Carrier": 0.0110,
    "Supramax": 0.0120,
}
DEFAULT_FUEL_INTENSITY = 0.0100

# Case/whitespace-insensitive lookup — vessel_type as typed by a caller
# (e.g. "PANAMAX", " panamax ") should resolve to the same fuel intensity
# as the canonical "Panamax" key, not silently fall back to the default
# (same rationale as the casefold matching in app/ml/predict.py).
_FUEL_INTENSITY_NORM = {
    k.strip().casefold(): v for k, v in FUEL_INTENSITY_TONS_PER_CARGO_TON.items()
}

RISK_WEIGHT = 0.35  # fraction of freight cost applied as uncertainty penalty at (1 - confidence)

OPTION_HORIZONS = {
    "charter_now": 0,
    "wait_7_days": 7,
    "wait_30_days": 30,
    "wait_90_days": 90,
}


@dataclass
class OptionResult:
    option: str
    horizon_days: int
    rate_used: float
    rate_type: str  # "current" | "predicted"
    confidence: Optional[float]
    lower_bound: Optional[float]
    upper_bound: Optional[float]
    freight_cost: float
    fuel_cost: float
    risk_adjustment: float
    total_estimated_cost: float
    canonical_route: Optional[dict] = None

    def as_dict(self):
        data = asdict(self)
        data.pop("canonical_route", None)
        return data


def _fuel_intensity(vessel_type: str) -> float:
    return _FUEL_INTENSITY_NORM.get(str(vessel_type).strip().casefold(), DEFAULT_FUEL_INTENSITY)


def evaluate_option(
    option_name: str,
    horizon_days: int,
    current_rate: float,
    fuel_price: float,
    cargo_quantity: float,
    vessel_type: str,
    df_history=None,
    origin: str = None,
    destination: str = None,
) -> OptionResult:
    """Return the option result and retain the canonical route internally for
    the optimizer response. Public API serialization omits that internal field."""
    canonical: Optional[dict] = None
    if horizon_days == 0:
        rate_used = current_rate
        rate_type = "current"
        confidence, lower, upper = 1.0, current_rate, current_rate
    else:
        fc = forecast_route(df_history, origin, destination, vessel_type, horizon_days=horizon_days)
        rate_used = fc["predicted_rate"]
        rate_type = "predicted"
        confidence = fc["confidence_score"]
        lower, upper = fc["lower_bound"], fc["upper_bound"]
        canonical = {
            "origin": fc["origin"], "destination": fc["destination"], "vessel_type": fc["vessel_type"],
        }

    freight_cost = rate_used * cargo_quantity
    fuel_cost = fuel_price * _fuel_intensity(vessel_type) * cargo_quantity
    risk_adjustment = (1 - confidence) * freight_cost * RISK_WEIGHT
    total_cost = freight_cost + fuel_cost + risk_adjustment

    return OptionResult(
        option=option_name,
        horizon_days=horizon_days,
        rate_used=round(rate_used, 2),
        rate_type=rate_type,
        confidence=round(confidence, 3) if confidence is not None else None,
        lower_bound=round(lower, 2) if lower is not None else None,
        upper_bound=round(upper, 2) if upper is not None else None,
        freight_cost=round(freight_cost, 2),
        fuel_cost=round(fuel_cost, 2),
        risk_adjustment=round(risk_adjustment, 2),
        total_estimated_cost=round(total_cost, 2),
        canonical_route=canonical,
    )


def optimize_procurement(
    df_history,
    origin: str,
    destination: str,
    vessel_type: str,
    cargo_quantity: float,
    current_rate: float,
    fuel_price: float,
) -> dict:
    options = {}
    canonical_route: Optional[dict] = None
    for name, horizon in OPTION_HORIZONS.items():
        opt_result = evaluate_option(
            name, horizon, current_rate, fuel_price, cargo_quantity, vessel_type,
            df_history=df_history, origin=origin, destination=destination,
        )
        options[name] = opt_result
        if canonical_route is None and opt_result.canonical_route is not None:
            canonical_route = opt_result.canonical_route

    best_name = min(options, key=lambda k: options[k].total_estimated_cost)
    baseline_cost = options["charter_now"].total_estimated_cost
    best = options[best_name]
    savings_vs_now = round(baseline_cost - best.total_estimated_cost, 2)

    # Echo back the canonical casing resolved from history (e.g. "Australia"/
    # "Panamax") rather than whatever casing the caller sent, so downstream
    # consumers (scenario history, UI) display a consistent route string —
    # same rationale as the /api/whatif scenario-persistence fix.
    return {
        "origin": canonical_route["origin"] if canonical_route else origin,
        "destination": canonical_route["destination"] if canonical_route else destination,
        "vessel_type": canonical_route["vessel_type"] if canonical_route else vessel_type,
        "cargo_quantity": cargo_quantity,
        "options": {k: v.as_dict() for k, v in options.items()},
        "best_option": best_name,
        "savings_vs_charter_now": savings_vs_now,
        "assumptions": {
            "fuel_intensity_tons_per_cargo_ton": _fuel_intensity(vessel_type),
            "risk_weight": RISK_WEIGHT,
            "note": "fuel intensity and risk weight are documented modeling "
                    "assumptions, not live market data (no external APIs used).",
        },
    }
