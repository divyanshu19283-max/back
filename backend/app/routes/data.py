from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.ingestion import ingest_csv_bytes
from app.services.eda import run_eda
from app.services.data_access import list_available_routes, get_freight_dataframe

router = APIRouter(prefix="/api/data", tags=["data"])


@router.post("/ingest")
async def ingest_csv(
    file: UploadFile = File(...),
    is_synthetic: bool = Query(False, description="Mark ingested rows as synthetic/demo data"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    report = ingest_csv_bytes(content, db, filename=file.filename, is_synthetic=is_synthetic)
    get_freight_dataframe(db, force_refresh=True)  # bust cache so new rows are visible immediately
    return report.as_dict()


@router.get("/eda")
def get_eda(db: Session = Depends(get_db)):
    return run_eda(db)


@router.get("/routes")
def get_routes(db: Session = Depends(get_db)):
    return {"routes": list_available_routes(db)}


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    df = get_freight_dataframe(db)
    if df.empty:
        return {"row_count": 0, "message": "No data ingested yet."}
    return {
        "row_count": int(len(df)),
        "synthetic_rows": int(df["is_synthetic"].sum()),
        "real_rows": int((~df["is_synthetic"]).sum()),
        "date_range": {"start": str(df["date"].min().date()), "end": str(df["date"].max().date())},
        "origins": sorted(df["origin"].unique().tolist()),
        "destinations": sorted(df["destination"].unique().tolist()),
        "vessel_types": sorted(df["vessel_type"].unique().tolist()),
        # unique origin->destination corridors, plus rate stats — additive
        # fields used by the frontend market-data summary cards.
        "route_count": int(df[["origin", "destination"]].drop_duplicates().shape[0]),
        "avg_freight_rate": round(float(df["freight_rate"].mean()), 2),
        "min_freight_rate": round(float(df["freight_rate"].min()), 2),
        "max_freight_rate": round(float(df["freight_rate"].max()), 2),
    }


@router.get("/history")
def get_history(
    origin: str,
    destination: str,
    vessel_type: str,
    limit: int = Query(90, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Raw historical freight_rate series for one route+vessel, most recent
    `limit` points — used to draw the historical half of the forecast
    chart (real ingested/seeded data, not synthesized for display)."""
    df = get_freight_dataframe(db)
    if df.empty:
        return {"origin": origin, "destination": destination, "vessel_type": vessel_type, "points": []}
    # Case/whitespace-insensitive match, same rationale as forecast_route()
    # in app/ml/predict.py — keeps this endpoint consistent with /api/forecast
    # and /api/whatif so a route that resolves there also resolves here.
    origin_norm = str(origin).strip().casefold()
    destination_norm = str(destination).strip().casefold()
    vessel_type_norm = str(vessel_type).strip().casefold()
    route_hist = df[
        (df["origin"].str.strip().str.casefold() == origin_norm)
        & (df["destination"].str.strip().str.casefold() == destination_norm)
        & (df["vessel_type"].str.strip().str.casefold() == vessel_type_norm)
    ].sort_values("date").tail(limit)
    points = [
        {"date": str(row["date"].date()), "rate": round(float(row["freight_rate"]), 2)}
        for _, row in route_hist.iterrows()
    ]
    return {"origin": origin, "destination": destination, "vessel_type": vessel_type, "points": points}
