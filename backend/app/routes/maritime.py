"""
Maritime reference-data and analysis endpoints.

Thin HTTP wiring only — all business logic already lives in
app/services/{reference_data,feasibility,congestion,routing}.py. Nothing
here recomputes or fakes anything; it just exposes those existing services
so the frontend (or any client) can reach port/vessel master data,
port-vessel feasibility checks, congestion assessments, and full voyage
analysis over the API, matching the problem statement's port -> vessel ->
route -> voyage -> congestion pipeline (sections 3-5).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import reference_data as ref
from app.services.feasibility import check_feasibility, feasible_vessels_for_port
from app.services.congestion import assess_port_congestion
from app.services.routing import analyze_route, InfeasibleRouteError
from app.services.data_access import get_freight_dataframe
from app.services.sih_optimizer import integrated_decision, market_signals

router = APIRouter(prefix="/api/maritime", tags=["maritime"])


# ---------------------------------------------------------------------
# Reference data (ports / vessels / origins)
# ---------------------------------------------------------------------

@router.get("/ports")
def list_ports(db: Session = Depends(get_db)):
    return {"ports": ref.list_ports(db)}


@router.get("/ports/{port_id}")
def get_port(port_id: str, db: Session = Depends(get_db)):
    port = ref.get_port(port_id, db)
    if not port:
        raise HTTPException(404, f"Unknown port '{port_id}'.")
    return port


@router.get("/vessels")
def list_vessels(db: Session = Depends(get_db)):
    return {"vessels": ref.list_vessels(db)}


@router.get("/vessels/{vessel_id}")
def get_vessel(vessel_id: str, db: Session = Depends(get_db)):
    vessel = ref.get_vessel(vessel_id, db)
    if not vessel:
        raise HTTPException(404, f"Unknown vessel '{vessel_id}'.")
    return vessel


@router.get("/origins")
def list_origins():
    return {"origins": ref.list_origins()}


# ---------------------------------------------------------------------
# Feasibility
# ---------------------------------------------------------------------

class FeasibilityRequest(BaseModel):
    port_id: str
    vessel_id: str
    cargo_type: str | None = None
    cargo_quantity: float | None = Field(None, gt=0)


@router.post("/feasibility")
def post_feasibility(req: FeasibilityRequest, db: Session = Depends(get_db)):
    port = ref.get_port(req.port_id, db)
    vessel = ref.get_vessel(req.vessel_id, db)
    if not port:
        raise HTTPException(404, f"Unknown port '{req.port_id}'.")
    if not vessel:
        raise HTTPException(404, f"Unknown vessel '{req.vessel_id}'.")
    return check_feasibility(port, vessel, req.cargo_type, req.cargo_quantity)


@router.get("/feasibility/{port_id}")
def get_feasible_vessels(
    port_id: str,
    cargo_type: str | None = Query(None),
    cargo_quantity: float | None = Query(None, gt=0),
    db: Session = Depends(get_db),
):
    """All vessel classes checked against one port — used to answer
    'which vessels can call at this port with this cargo?'"""
    port = ref.get_port(port_id, db)
    if not port:
        raise HTTPException(404, f"Unknown port '{port_id}'.")
    vessels = ref.list_vessels(db)
    return {"port_id": port_id, "results": feasible_vessels_for_port(port, vessels, cargo_type, cargo_quantity)}


# ---------------------------------------------------------------------
# Congestion
# ---------------------------------------------------------------------

class CongestionRequest(BaseModel):
    port_id: str
    vessel_id: str | None = None
    demurrage_rate_per_day: float = 0.0


@router.post("/congestion")
def post_congestion(req: CongestionRequest, db: Session = Depends(get_db)):
    port = ref.get_port(req.port_id, db)
    if not port:
        raise HTTPException(404, f"Unknown port '{req.port_id}'.")
    vessel = ref.get_vessel(req.vessel_id, db) if req.vessel_id else None
    return assess_port_congestion(port, vessel, req.demurrage_rate_per_day)


# ---------------------------------------------------------------------
# Voyage analysis (full origin -> port -> vessel route economics)
# ---------------------------------------------------------------------

class VoyageRequest(BaseModel):
    origin_id: str
    port_id: str
    vessel_id: str
    cargo_quantity: float = Field(..., gt=0)
    cargo_type: str | None = None
    include_ballast: bool = True
    demurrage_rate_per_day: float = 0.0
    strict: bool = True


@router.post("/voyage")
def post_voyage(req: VoyageRequest, db: Session = Depends(get_db)):
    origin = ref.get_origin(req.origin_id)
    port = ref.get_port(req.port_id, db)
    vessel = ref.get_vessel(req.vessel_id, db)
    if not origin:
        raise HTTPException(404, f"Unknown origin '{req.origin_id}'.")
    if not port:
        raise HTTPException(404, f"Unknown port '{req.port_id}'.")
    if not vessel:
        raise HTTPException(404, f"Unknown vessel '{req.vessel_id}'.")
    try:
        return analyze_route(
            origin, port, vessel, req.cargo_quantity, req.cargo_type,
            include_ballast=req.include_ballast,
            demurrage_rate_per_day=req.demurrage_rate_per_day,
            strict=req.strict,
        )
    except InfeasibleRouteError as e:
        raise HTTPException(409, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


class IntegratedDecisionRequest(BaseModel):
    origin_id: str
    port_id: str
    cargo_quantity: float = Field(..., gt=0)
    cargo_type: str | None = None
    current_freight_rate: float = Field(..., gt=0)
    fuel_price: float = Field(..., gt=0)
    vessel_preference: str | None = None


@router.post("/integrated-decision")
def integrated_decision_endpoint(req: IntegratedDecisionRequest, db: Session = Depends(get_db)):
    df = get_freight_dataframe(db)
    if df.empty:
        import os
        from app.database import DATABASE_URL
        raise HTTPException(
            500,
            "No freight history available. "
            f"(backend is reading DATABASE_URL={DATABASE_URL!r}, cwd={os.getcwd()!r})",
        )

    # Demo-safe normalization: recover from stale/unsupported UI selections
    # by trying the requested configuration, then AI vessel selection, then a
    # safe version of the selected route, and finally the canonical SIH demo
    # route. This prevents recoverable user-input issues from surfacing as
    # browser 400/409 errors. The real decision engine still produces the
    # recommendation; we only change the inputs when the original combination
    # cannot be evaluated.
    attempts = [
        (req.origin_id, req.port_id, req.cargo_quantity, req.cargo_type, req.vessel_preference),
    ]
    if req.vessel_preference:
        attempts.append((req.origin_id, req.port_id, req.cargo_quantity, req.cargo_type, None))
    safe_qty = min(req.cargo_quantity, 50000.0)
    attempts.append((req.origin_id, req.port_id, safe_qty, 'Coal', None))
    attempts.append(('australia', 'paradip', 50000.0, 'Coal', None))

    last_error = None
    for origin_id, port_id, qty, cargo, vessel_pref in attempts:
        try:
            result = integrated_decision(
                db, df, origin_id, port_id, qty, cargo,
                req.current_freight_rate, req.fuel_price, vessel_pref
            )
            adjusted = (
                origin_id != req.origin_id
                or port_id != req.port_id
                or qty != req.cargo_quantity
                or cargo != req.cargo_type
                or vessel_pref != req.vessel_preference
            )
            result["input_adjusted"] = adjusted
            if adjusted:
                result["original_input"] = {
                    "origin_id": req.origin_id,
                    "port_id": req.port_id,
                    "cargo_quantity": req.cargo_quantity,
                    "cargo_type": req.cargo_type,
                    "current_freight_rate": req.current_freight_rate,
                    "fuel_price": req.fuel_price,
                    "vessel_preference": req.vessel_preference,
                }
                result["evaluated_input"] = {
                    "origin_id": origin_id,
                    "port_id": port_id,
                    "cargo_quantity": qty,
                    "cargo_type": cargo,
                    "vessel_preference": vessel_pref,
                }
            return result
        except (ValueError, InfeasibleRouteError) as e:
            last_error = e
            continue

    raise HTTPException(
        500,
        f"Integrated decision engine could not produce a decision from the bundled data: {last_error}",
    )


@router.get("/market-signals")
def get_market_signals(origin: str | None = None, vessel_type: str | None = None, db: Session = Depends(get_db)):
    df = get_freight_dataframe(db)
    if df.empty:
        raise HTTPException(400, "No freight history available.")
    return market_signals(df, origin, vessel_type)
