import json
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.freight import CharterRecommendation, Scenario, ModelRun
from app.schemas.freight import WhatIfRequest, OptimizeRequest
from app.services.data_access import get_freight_dataframe
from app.services.whatif import run_whatif_scenario
from app.services.optimizer import optimize_procurement
from app.ml.predict import ModelNotTrainedError, ModelLoadError

router = APIRouter(prefix="/api", tags=["decision"])


@router.post("/whatif")
def whatif(req: WhatIfRequest, db: Session = Depends(get_db)):
    df = get_freight_dataframe(db)
    if df.empty:
        import os
        from app.database import DATABASE_URL
        raise HTTPException(
            400,
            "No data available. Ingest or seed data first. "
            f"(backend is reading DATABASE_URL={DATABASE_URL!r}, "
            f"cwd={os.getcwd()!r} — if this points at an empty/wrong DB, "
            "that's why every request 400s regardless of payload.)",
        )
    try:
        result = run_whatif_scenario(
            df, req.origin, req.destination, req.vessel_type,
            cargo_quantity=req.cargo_quantity, current_rate=req.current_freight_rate,
            fuel_price=req.fuel_price, horizon_days=req.horizon_days,
        )
    except ModelNotTrainedError as e:
        raise HTTPException(409, str(e))
    except ModelLoadError as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))

    if req.save_scenario:
        # Persist the canonical casing resolved by the forecast step (e.g.
        # "Australia" / "Panamax"), not the raw request casing (which may be
        # "AUSTRALIA" / "PANAMAX" or any other case a caller sends) — keeps
        # scenario/recommendation history display-consistent regardless of
        # how the request was cased.
        canon_origin = result["forecast"]["origin"]
        canon_destination = result["forecast"]["destination"]
        canon_vessel = result["forecast"]["vessel_type"]
        db.add(Scenario(
            origin=canon_origin, destination=canon_destination,
            cargo_quantity=req.cargo_quantity, vessel_size=canon_vessel,
            current_rate=req.current_freight_rate, fuel_price=req.fuel_price,
            predicted_rate=result["forecast"]["predicted_rate"],
            recommendation=result["recommended_action"],
            estimated_savings=result["expected_saving"],
            result_json=json.dumps(result),
        ))
        db.add(CharterRecommendation(
            origin=canon_origin, destination=canon_destination,
            cargo_quantity=req.cargo_quantity, vessel_size=canon_vessel,
            current_rate=req.current_freight_rate,
            predicted_rate=result["forecast"]["predicted_rate"],
            estimated_cost_now=result["estimated_cost_now"],
            estimated_cost_later=result["estimated_cost_later"],
            expected_saving=result["expected_saving"],
            recommendation=result["recommended_action"],
            reason=result["reason"],
            risk_level=result["risk_level"],
            confidence=result["confidence"],
        ))
        db.commit()

    return result


@router.post("/optimize")
def optimize(req: OptimizeRequest, db: Session = Depends(get_db)):
    df = get_freight_dataframe(db)
    if df.empty:
        raise HTTPException(400, "No data available. Ingest or seed data first.")
    try:
        return optimize_procurement(
            df, req.origin, req.destination, req.vessel_type,
            cargo_quantity=req.cargo_quantity, current_rate=req.current_freight_rate,
            fuel_price=req.fuel_price,
        )
    except ModelNotTrainedError as e:
        raise HTTPException(409, str(e))
    except ModelLoadError as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/recommendations/history")
def recommendation_history(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.execute(
        select(CharterRecommendation).order_by(CharterRecommendation.created_at.desc()).limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id, "origin": r.origin, "destination": r.destination,
            "cargo_quantity": r.cargo_quantity, "vessel_size": r.vessel_size,
            "current_rate": r.current_rate, "predicted_rate": r.predicted_rate,
            "recommendation": r.recommendation, "reason": r.reason,
            "risk_level": r.risk_level, "confidence": r.confidence,
            "expected_saving": r.expected_saving, "created_at": str(r.created_at),
        }
        for r in rows
    ]


@router.get("/scenarios/history")
def scenario_history(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.execute(select(Scenario).order_by(Scenario.created_at.desc()).limit(limit)).scalars().all()
    out = []
    for r in rows:
        # confidence/risk_level aren't dedicated columns on this table, but
        # they were computed as part of the same what-if call and stored in
        # result_json for audit/replay — surface them from there rather than
        # leaving the field out (this is the same real number, not a guess).
        confidence, risk_level = None, None
        if r.result_json:
            try:
                payload = json.loads(r.result_json)
                confidence = payload.get("confidence")
                risk_level = payload.get("risk_level")
            except (TypeError, ValueError):
                pass
        out.append({
            "id": r.id, "origin": r.origin, "destination": r.destination,
            "cargo_quantity": r.cargo_quantity, "vessel_size": r.vessel_size,
            "current_rate": r.current_rate, "fuel_price": r.fuel_price,
            "predicted_rate": r.predicted_rate, "recommendation": r.recommendation,
            "estimated_savings": r.estimated_savings, "created_at": str(r.created_at),
            "confidence": confidence, "risk_level": risk_level,
        })
    return out


@router.get("/model-runs")
def model_runs(limit: int = 50, db: Session = Depends(get_db)):
    """Return a complete model-evaluation audit set.

    The database is authoritative when a run exists, but bundled training
    metadata is used to fill any missing model/horizon combinations. This
    prevents a partially seeded/older database from making Model Intelligence
    silently incomplete. No metrics are fabricated.
    """
    by_key = {}
    rows = db.execute(select(ModelRun).order_by(ModelRun.created_at.desc())).scalars().all()
    for r in rows:
        by_key.setdefault((r.model_name, int(r.horizon_days)), {
            "id": r.id, "model_name": r.model_name, "horizon_days": r.horizon_days,
            "mae": r.mae, "rmse": r.rmse, "mape": r.mape, "r2": r.r2,
            "training_rows": r.training_rows, "is_best_model": r.is_best_model,
            "training_start": str(r.training_start), "training_end": str(r.training_end),
            "created_at": str(r.created_at),
        })

    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    meta_dir = os.path.join(backend_root, "data", "trained_models")
    next_id = 1_000_000
    for horizon in (7, 30, 90):
        path = os.path.join(meta_dir, f"model_h{horizon}_meta.json")
        try:
            with open(path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
        except (OSError, ValueError):
            continue
        for model_name, metrics in meta.get("leaderboard", {}).items():
            key = (model_name, int(horizon))
            if key not in by_key:
                by_key[key] = {
                    "id": next_id, "model_name": model_name, "horizon_days": int(horizon),
                    "mae": float(metrics.get("mae", 0)), "rmse": float(metrics.get("rmse", 0)),
                    "mape": float(metrics.get("mape", 0)), "r2": metrics.get("r2"),
                    "training_rows": int(meta.get("training_rows", 0)),
                    "is_best_model": model_name == meta.get("best_model"),
                    "training_start": str(meta.get("training_start", "")),
                    "training_end": str(meta.get("training_end", "")),
                    "created_at": str(meta.get("training_end", "")),
                }
                next_id += 1

    result = list(by_key.values())
    result.sort(key=lambda x: (int(x["horizon_days"]), x["model_name"]))
    return result[:max(1, min(limit, len(result)))]
