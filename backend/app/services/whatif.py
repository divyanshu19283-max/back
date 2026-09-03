"""
What-if simulator.

Single entry point a user (or the API route) calls with a scenario:
    cargo_quantity, origin, destination, vessel_size/type,
    current_freight_rate, fuel_price

Returns: predicted rate, expected total cost, alternative scenarios
(via the optimizer), recommended action, expected savings, risk, confidence.

Everything here executes locally against the trained models and the DB
history — no external calls.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from app.ml.predict import forecast_route
from app.services.decision_engine import evaluate_charter_decision
from app.services.optimizer import optimize_procurement


def run_whatif_scenario(
    df_history,
    origin: str,
    destination: str,
    vessel_type: str,
    cargo_quantity: float,
    current_rate: float,
    fuel_price: float,
    horizon_days: int = 30,
) -> dict:
    forecast = forecast_route(
        df_history, origin, destination, vessel_type, horizon_days=horizon_days
    )

    decision = evaluate_charter_decision(
        current_rate=current_rate,
        predicted_rate=forecast["predicted_rate"],
        lower_bound=forecast["lower_bound"],
        upper_bound=forecast["upper_bound"],
        confidence_score=forecast["confidence_score"],
        cargo_quantity=cargo_quantity,
    )

    optimization = optimize_procurement(
        df_history, origin, destination, vessel_type,
        cargo_quantity=cargo_quantity, current_rate=current_rate, fuel_price=fuel_price,
    )

    return {
        "scenario_input": {
            "origin": origin,
            "destination": destination,
            "vessel_type": vessel_type,
            "cargo_quantity": cargo_quantity,
            "current_freight_rate": current_rate,
            "fuel_price": fuel_price,
            "horizon_days": horizon_days,
        },
        "forecast": forecast,
        "recommended_action": decision.recommendation,
        "reason": decision.reason,
        "risk_level": decision.risk_level,
        "confidence": decision.confidence,
        "expected_saving": decision.expected_saving,
        "estimated_cost_now": decision.estimated_cost_now,
        "estimated_cost_later": decision.estimated_cost_later,
        "alternative_scenarios": optimization["options"],
        "best_procurement_option": optimization["best_option"],
        "savings_vs_charter_now": optimization["savings_vs_charter_now"],
        "assumptions": optimization["assumptions"],
    }
