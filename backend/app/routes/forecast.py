from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.database import get_db
from app.models.freight import Forecast
from app.schemas.freight import ForecastRequest
from app.services.data_access import get_freight_dataframe
from app.ml.predict import forecast_route, ModelNotTrainedError, ModelLoadError

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.post("")
def create_forecast(req: ForecastRequest, db: Session = Depends(get_db)):
    df = get_freight_dataframe(db)
    if df.empty:
        raise HTTPException(400, "No data available. Ingest or seed data first.")
    try:
        result = forecast_route(
            df, req.origin, req.destination, req.vessel_type, horizon_days=req.horizon_days
        )
    except ModelNotTrainedError as e:
        raise HTTPException(409, str(e))
    except ModelLoadError as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))

    row = Forecast(
        forecast_date=datetime.strptime(result["forecast_date"], "%Y-%m-%d").date(),
        origin=req.origin,
        destination=req.destination,
        vessel_type=req.vessel_type,
        horizon_days=req.horizon_days,
        predicted_rate=result["predicted_rate"],
        lower_bound=result["lower_bound"],
        upper_bound=result["upper_bound"],
        confidence_score=result["confidence_score"],
        model_name=result["model_name"],
    )
    db.add(row)
    db.commit()

    return result


@router.get("/history")
def forecast_history(origin: str = None, destination: str = None, limit: int = 50, db: Session = Depends(get_db)):
    stmt = select(Forecast).order_by(Forecast.created_at.desc()).limit(limit)
    if origin:
        stmt = stmt.where(Forecast.origin == origin)
    if destination:
        stmt = stmt.where(Forecast.destination == destination)
    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": r.id, "forecast_date": str(r.forecast_date), "origin": r.origin,
            "destination": r.destination, "vessel_type": r.vessel_type,
            "horizon_days": r.horizon_days, "predicted_rate": r.predicted_rate,
            "lower_bound": r.lower_bound, "upper_bound": r.upper_bound,
            "confidence_score": r.confidence_score, "model_name": r.model_name,
            "created_at": str(r.created_at),
        }
        for r in rows
    ]
