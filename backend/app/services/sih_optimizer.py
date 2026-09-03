"""SIH26006 integrated decision engine.

Combines freight forecasts, contract duration, port/vessel feasibility,
congestion and idle-employment alternatives into one auditable recommendation.
All reference/market inputs are tagged as demo/synthetic when applicable.
"""
from __future__ import annotations
from statistics import mean
from app.ml.predict import forecast_route
from app.services.feasibility import check_feasibility
from app.services.routing import analyze_route, InfeasibleRouteError
from app.services.congestion import assess_port_congestion
from app.services.reference_data import list_ports, list_vessels, get_origin
from app.data.distances import sea_distance_nm

CONTRACTS = {
    1: {"name": "Spot", "label": "1 voyage", "discount": 0.00, "commitment_risk": 0.55},
    3: {"name": "Short-term", "label": "3 voyages", "discount": 0.025, "commitment_risk": 0.35},
    6: {"name": "Medium-term", "label": "6 voyages", "discount": 0.045, "commitment_risk": 0.25},
    12: {"name": "Extended", "label": "12 voyages", "discount": 0.065, "commitment_risk": 0.30},
}


def _norm_vessel(name: str) -> str:
    return name.strip().lower().replace(" ", "")


def _vessel_score(v, port, origin, cargo_type, cargo_qty, congestion):
    f = check_feasibility(port, v, cargo_type, cargo_qty)
    origin_reasons = []
    if v["draft"] > origin.get("max_draft", 999): origin_reasons.append("Origin draft limit")
    if v["loa"] > origin.get("max_loa", 999): origin_reasons.append("Origin LOA limit")
    if v["beam"] > origin.get("max_beam", 999): origin_reasons.append("Origin beam limit")
    if cargo_type and cargo_type not in origin.get("typical_cargo", []): origin_reasons.append("Origin cargo compatibility warning")
    if f["status"] == "NOT_FEASIBLE":
        return None
    if origin_reasons:
        f = dict(f)
        f["status"] = "FEASIBLE_WITH_WARNINGS"
        f["warnings"] = list(f.get("warnings", [])) + origin_reasons
    capacity_gap = max(0.0, (v["cargo_capacity"] - cargo_qty) / max(v["cargo_capacity"], 1))
    utilization_penalty = max(0.0, congestion["congestion_index"] - 50) / 100
    cost_per_ton = (v["daily_charter_rate"] + v["daily_opex"]) / max(v["cargo_capacity"], 1)
    score = 100 - capacity_gap * 25 - utilization_penalty * 20 - cost_per_ton * 1000
    if f["status"] == "FEASIBLE_WITH_WARNINGS":
        score -= 8
    return score, f


def build_contract_options(df, origin, port, vessel, cargo_qty, current_rate, fuel_price, cargo_type):
    out = []
    for voyages, spec in CONTRACTS.items():
        if voyages == 1:
            rate = current_rate
            confidence = 1.0
            lower = upper = current_rate
        else:
            horizon = 7 if voyages == 3 else 30 if voyages == 6 else 90
            fc = forecast_route(df, origin, "East Coast India", vessel["vessel_type"], horizon_days=horizon)
            rate = fc["predicted_rate"]
            confidence = fc["confidence_score"]
            lower, upper = fc["lower_bound"], fc["upper_bound"]
        base_rate = rate * (1 - spec["discount"])
        freight_cost = base_rate * cargo_qty * voyages
        fuel_cost = fuel_price * 0.0105 * cargo_qty * voyages
        congestion = assess_port_congestion(port, vessel)
        idle_cost = congestion["additional_idle_days"] * (vessel["daily_charter_rate"] + vessel["daily_opex"]) * voyages
        uncertainty = (1 - confidence) * freight_cost * 0.30
        commitment = spec["commitment_risk"] * freight_cost * 0.025
        total = freight_cost + fuel_cost + idle_cost + uncertainty + commitment
        out.append({
            "voyages": voyages, "contract": spec["name"], "label": spec["label"],
            "effective_rate": round(base_rate, 2), "forecast_rate": round(rate, 2),
            "confidence": round(confidence, 3), "lower_bound": round(lower, 2), "upper_bound": round(upper, 2),
            "freight_cost": round(freight_cost, 2), "fuel_cost": round(fuel_cost, 2),
            "congestion_idle_cost": round(idle_cost, 2), "uncertainty_cost": round(uncertainty, 2),
            "commitment_cost": round(commitment, 2), "total_cost": round(total, 2),
            "cost_per_ton": round(total / max(cargo_qty * voyages, 1), 2),
            "discount_pct": spec["discount"] * 100,
        })
    best = min(out, key=lambda x: x["total_cost"])
    spot = out[0]
    for x in out:
        x["savings_vs_spot"] = round(spot["total_cost"] - x["total_cost"], 2)
    return out, best


def integrated_decision(db, df, origin_id, port_id, cargo_qty, cargo_type, current_rate, fuel_price, vessel_preference=None):
    origin = get_origin(origin_id)
    ports = list_ports(db)
    vessels = list_vessels(db)
    # Accept either stable IDs or human-facing port names, case-insensitively.
    port_key = str(port_id or "").strip().casefold().replace(" ", "_").replace("/", "_")
    port = next((p for p in ports if str(p["id"]).strip().casefold() == port_key or str(p["name"]).strip().casefold() == str(port_id or "").strip().casefold()), None)
    if not origin or not port:
        raise ValueError("Unknown origin or destination port")
    port_id = port["id"]

    # Vessel classes in the master catalog (app/data/vessels.py) are not all
    # represented in the freight-rate history the forecasting model was
    # trained on (e.g. "Handysize" has zero rows for any route). Recommending
    # a vessel class we have no market data to price for a multi-voyage
    # contract makes the forecast step fail. Restrict *automatic* selection
    # to vessel classes the model can actually price; an explicit
    # vessel_preference is still honored as-is (the caller asked for it by
    # name), so it can still surface a clear "no historical data" error if
    # that specific class truly has none.
    # Case/whitespace-insensitive match — same convention as forecast_route()
    # in app/ml/predict.py. An exact `==` here would silently return zero
    # priceable vessel types (and therefore always raise "No vessel class is
    # feasible") for any origin/destination whose stored casing differs even
    # slightly from origin["region"]/"East Coast India" (e.g. CSV-ingested
    # data), independent of the actual /whatif payload.
    _region_norm = str(origin["region"]).strip().casefold()
    priceable_types = set(
        df.loc[
            (df["origin"].str.strip().str.casefold() == _region_norm)
            & (df["destination"].str.strip().str.casefold() == "east coast india"),
            "vessel_type",
        ].unique()
    )

    vessel_rows = []
    for v in vessels:
        if not vessel_preference and v["vessel_type"] not in priceable_types:
            continue
        c = assess_port_congestion(port, v)
        scored = _vessel_score(v, port, origin, cargo_type, cargo_qty, c)
        if scored:
            score, feasibility = scored
            vessel_rows.append({
                "vessel_id": v["id"], "vessel_type": v["vessel_type"], "score": round(score, 2),
                "cargo_capacity": v["cargo_capacity"], "draft": v["draft"], "loa": v["loa"], "beam": v["beam"],
                "daily_charter_rate": v["daily_charter_rate"], "feasibility": feasibility,
            })
    vessel_rows.sort(key=lambda x: x["score"], reverse=True)
    if vessel_preference:
        pref = _norm_vessel(vessel_preference)
        vessel_rows.sort(key=lambda x: 0 if _norm_vessel(x["vessel_type"]) == pref else 1)
    if not vessel_rows:
        raise ValueError(
            f"No vessel class is feasible for this cargo and port. "
            f"origin={origin['region']!r}, port={port['name']!r}, cargo_qty={cargo_qty}, "
            f"cargo_type={cargo_type!r}, vessel_preference={vessel_preference!r}. "
            f"Priceable vessel types for this origin/destination in the loaded "
            f"freight history: {sorted(priceable_types) or '(none — origin/destination not found in data)'}. "
            f"Vessel classes considered: {[v['vessel_type'] for v in vessels]}."
        )

    selected_id = vessel_rows[0]["vessel_id"]
    selected = next(v for v in vessels if v["id"] == selected_id)
    contract_options, best_contract = build_contract_options(df, origin["region"], port, selected, cargo_qty, current_rate, fuel_price, cargo_type)
    voyage = analyze_route(origin, port, selected, cargo_qty, cargo_type, strict=True)
    congestion = voyage["congestion"]

    # Alternative employment / positioning: score every other discharge port.
    alternatives = []
    for alt in ports:
        if alt["id"] == port["id"]:
            continue
        f = check_feasibility(alt, selected, cargo_type, min(cargo_qty, selected["cargo_capacity"]))
        if f["status"] == "NOT_FEASIBLE":
            continue
        cg = assess_port_congestion(alt, selected)
        dist = sea_distance_nm(origin, alt)["distance_nm"]
        reposition_days = dist / (selected["ballast_speed"] * 24)
        daily_cost = selected["daily_charter_rate"] + selected["daily_opex"]
        reposition_cost = reposition_days * daily_cost
        alternatives.append({
            "port_id": alt["id"], "port_name": alt["name"], "congestion_level": cg["congestion_level"],
            "congestion_index": cg["congestion_index"], "reposition_days": round(reposition_days, 2),
            "reposition_cost_usd": round(reposition_cost, 2), "idle_days_avoided": round(congestion["additional_idle_days"], 2),
            "feasibility": f["status"],
            "strategy": "Reposition / alternate employment" if cg["congestion_index"] < congestion["congestion_index"] else "Backup port",
        })
    alternatives.sort(key=lambda x: (x["congestion_index"] + x["reposition_days"] * 5, x["reposition_cost_usd"]))
    idle_plan = {
        "trigger": "HIGH/CRITICAL congestion or forecast demand weakness",
        "current_idle_days": congestion["additional_idle_days"],
        "recommended_strategy": alternatives[0]["strategy"] if alternatives else "Hold position and monitor market",
        "alternatives": alternatives[:5],
        "deadheading_note": "Repositioning is costed before recommending alternative employment.",
    }

    # Risk alerts are deterministic and auditable.
    risks = []
    if congestion["congestion_level"] in ("HIGH", "CRITICAL"):
        risks.append({"level": "HIGH", "type": "PORT_CONGESTION", "message": f"{port['name']} congestion is {congestion['congestion_level']} ({congestion['congestion_index']})."})
    if best_contract["confidence"] < 0.65:
        risks.append({"level": "HIGH", "type": "FORECAST_UNCERTAINTY", "message": "Forecast confidence is below 65%; avoid aggressive long-duration commitment."})
    if best_contract["upper_bound"] - best_contract["lower_bound"] > max(best_contract["forecast_rate"] * 0.25, 1):
        risks.append({"level": "MEDIUM", "type": "RATE_VOLATILITY", "message": "Forecast interval is wide relative to the expected rate."})
    if congestion["additional_idle_days"] > 2:
        risks.append({"level": "MEDIUM", "type": "IDLE_TIME", "message": "Expected congestion-driven idle time exceeds two days."})
    if not risks:
        risks.append({"level": "LOW", "type": "MARKET", "message": "No modeled high-severity trigger detected from current inputs."})

    return {
        "recommendation": {
            "contract": best_contract["contract"], "voyages": best_contract["voyages"],
            "vessel_type": selected["vessel_type"], "port": port["name"],
            "reason": f"Lowest risk-adjusted total cost at {best_contract['label']} with {best_contract['confidence']*100:.0f}% forecast confidence.",
        },
        "contract_options": contract_options,
        "vessel_ranking": vessel_rows,
        "selected_vessel": selected,
        "voyage": voyage,
        "idle_management": idle_plan,
        "risk_alerts": risks,
        "data_provenance": {
            "market_history": "SYNTHETIC demo dataset — replaceable through CSV ingestion",
            "port_master": port.get("data_source", "DEMO_ASSUMED"),
            "route_distance": voyage["distance"]["data_source"],
            "live_port_feed": False,
        },
    }


def market_signals(df, origin=None, vessel_type=None):
    x = df.copy()
    if origin:
        x = x[x["origin"].str.lower() == origin.lower()]
    if vessel_type and "vessel_type" in x:
        x2 = x[x["vessel_type"].str.lower() == vessel_type.lower()]
        if not x2.empty: x = x2
    if x.empty:
        return {}
    cols = [c for c in ["freight_rate", "fuel_price", "demand_index", "supply_index", "port_congestion_index"] if c in x]
    latest = x.sort_values("date").tail(30)
    result = {c: round(float(latest[c].mean()), 2) for c in cols}
    if "demand_index" in x and "supply_index" in x:
        result["demand_supply_pressure"] = round(result["demand_index"] - result["supply_index"], 2)
    result["observations"] = int(len(x))
    result["data_classification"] = "SYNTHETIC/DEMO"
    return result
