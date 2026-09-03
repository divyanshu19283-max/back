"""Port-vessel feasibility engine (problem statement section 3).

Runs six hard/soft checks for a (port, vessel, cargo) triple:

    draft     vessel.draft <= port.max_draft
    loa       vessel.loa   <= port.max_loa
    beam      vessel.beam  <= port.max_beam
    cargo     cargo type supported by the port (and carriable by the class)
    capacity  vessel cargo_capacity >= cargo quantity (and port DWT limit)
    handling  loading/discharge duration is computable and within limits

Every failure returns an explicit, human-readable reason, e.g.:

    "Panamax rejected because vessel draft 14.2m exceeds port maximum
     draft 13.5m at Gopalpur."
"""
from __future__ import annotations

SAFETY_MARGIN_M = 0.3  # under-keel / manoeuvring margin applied to draft (DEMO_ASSUMED)


def _fmt(x: float) -> str:
    return f"{round(float(x), 2):g}"


def effective_discharge_rate(port: dict, vessel: dict) -> float:
    """Discharge is limited by the slower of shore handling and ship's gear."""
    return min(float(port["cargo_handling_rate"]), float(vessel["discharge_rate"]))


def effective_loading_rate(port: dict, vessel: dict) -> float:
    return min(float(port["cargo_handling_rate"]), float(vessel["loading_rate"]))


def check_feasibility(
    port: dict,
    vessel: dict,
    cargo_type: str | None = None,
    cargo_quantity: float | None = None,
) -> dict:
    checks: dict[str, bool] = {}
    reasons: list[str] = []
    warnings: list[str] = []
    vt, pn = vessel["vessel_type"], port["name"]

    # --- draft -------------------------------------------------------------
    required_draft = float(vessel["draft"]) + SAFETY_MARGIN_M
    checks["draft"] = required_draft <= float(port["max_draft"])
    if not checks["draft"]:
        reasons.append(
            f"{vt} rejected because vessel draft {_fmt(vessel['draft'])}m "
            f"(+{_fmt(SAFETY_MARGIN_M)}m under-keel margin) exceeds port maximum "
            f"draft {_fmt(port['max_draft'])}m at {pn}."
        )

    # --- LOA ---------------------------------------------------------------
    checks["loa"] = float(vessel["loa"]) <= float(port["max_loa"])
    if not checks["loa"]:
        reasons.append(
            f"{vt} rejected because vessel LOA {_fmt(vessel['loa'])}m exceeds "
            f"port maximum LOA {_fmt(port['max_loa'])}m at {pn}."
        )

    # --- beam --------------------------------------------------------------
    checks["beam"] = float(vessel["beam"]) <= float(port["max_beam"])
    if not checks["beam"]:
        reasons.append(
            f"{vt} rejected because vessel beam {_fmt(vessel['beam'])}m exceeds "
            f"port maximum beam {_fmt(port['max_beam'])}m at {pn}."
        )

    # --- cargo compatibility ----------------------------------------------
    if cargo_type:
        port_ok = cargo_type in port["cargo_types_supported"]
        ship_ok = cargo_type in vessel["cargo_types"]
        checks["cargo"] = port_ok and ship_ok
        if not port_ok:
            reasons.append(
                f"Cargo '{cargo_type}' rejected because {pn} handles only "
                f"{', '.join(port['cargo_types_supported'])}."
            )
        if not ship_ok:
            reasons.append(
                f"Cargo '{cargo_type}' rejected because a {vt} in this master data "
                f"carries only {', '.join(vessel['cargo_types'])}."
            )
    else:
        checks["cargo"] = True
        warnings.append("No cargo_type supplied — cargo compatibility check skipped.")

    # --- capacity ----------------------------------------------------------
    if cargo_quantity:
        qty = float(cargo_quantity)
        cap_ok = qty <= float(vessel["cargo_capacity"])
        dwt_ok = float(vessel["dwt"]) <= float(port["max_vessel_size"])
        checks["capacity"] = cap_ok and dwt_ok
        if not cap_ok:
            reasons.append(
                f"{vt} rejected because cargo quantity {_fmt(qty)} t exceeds vessel "
                f"cargo capacity {_fmt(vessel['cargo_capacity'])} t "
                f"({_fmt(qty / float(vessel['cargo_capacity']))} vessels would be needed)."
            )
        if not dwt_ok:
            reasons.append(
                f"{vt} rejected because vessel size {_fmt(vessel['dwt'])} DWT exceeds "
                f"the maximum vessel size {_fmt(port['max_vessel_size'])} DWT accepted at {pn}."
            )
        if cap_ok and qty < 0.5 * float(vessel["cargo_capacity"]):
            warnings.append(
                f"Parcel fills only {round(100 * qty / float(vessel['cargo_capacity']))}% of the "
                f"{vt}; freight cost per tonne will be inflated by dead freight."
            )
    else:
        checks["capacity"] = True
        warnings.append("No cargo_quantity supplied — capacity check skipped.")

    # --- handling ----------------------------------------------------------
    rate = effective_discharge_rate(port, vessel)
    handling_days = None
    if rate <= 0:
        checks["handling"] = False
        reasons.append(f"{pn} reports a non-positive cargo handling rate; discharge time undefined.")
    elif cargo_quantity:
        handling_days = round(float(cargo_quantity) / rate, 2)
        checks["handling"] = True
    else:
        checks["handling"] = True

    if port.get("operating_status") not in (None, "OPERATIONAL"):
        checks["handling"] = False
        reasons.append(f"{pn} is currently {port['operating_status']} and cannot accept calls.")

    status = "FEASIBLE" if all(checks.values()) else "NOT_FEASIBLE"
    if status == "FEASIBLE" and warnings:
        status = "FEASIBLE_WITH_WARNINGS"

    return {
        "status": status,
        "port": {"id": port["id"], "name": pn},
        "vessel": {"id": vessel["id"], "vessel_type": vt},
        "cargo_type": cargo_type,
        "cargo_quantity": cargo_quantity,
        "checks": checks,
        "reasons": reasons,
        "warnings": warnings,
        "handling": {
            "effective_loading_rate_tpd": effective_loading_rate(port, vessel),
            "effective_discharge_rate_tpd": rate,
            "estimated_discharge_days": handling_days,
            "estimated_loading_days": (
                round(float(cargo_quantity) / effective_loading_rate(port, vessel), 2)
                if cargo_quantity and effective_loading_rate(port, vessel) > 0 else None
            ),
        },
        "restrictions": port.get("restrictions", []),
        "data_source": port.get("data_source"),
        "data_timestamp": port.get("data_timestamp"),
    }


def feasible_vessels_for_port(
    port: dict,
    vessels: list[dict],
    cargo_type: str | None = None,
    cargo_quantity: float | None = None,
) -> list[dict]:
    return [check_feasibility(port, v, cargo_type, cargo_quantity) for v in vessels]
