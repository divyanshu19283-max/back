
import json
import os
from contextlib import asynccontextmanager
from datetime import date as date_type

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text, func

from app.database import init_db, SessionLocal
from app.models.freight import ModelRun, FreightRate
from app.routes import data, forecast, decision, maritime, chat
from app.services.reference_data import seed_reference_data
from app.ml.train import MODEL_DIR, HORIZONS


BACKEND_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

RAW_CSV_PATH = os.path.join(
    BACKEND_DIR,
    "data",
    "raw",
    "synthetic_freight_data.csv",
)


def seed_freight_history_if_empty(db) -> int:
    """
    Automatically seed freight history when the database is empty.
    """
    row_count = (
        db.execute(
            select(func.count()).select_from(FreightRate)
        ).scalar()
        or 0
    )

    if row_count > 0:
        return 0

    import pandas as pd
    from app.services.ingestion import ingest_dataframe
    from app.utils.synthetic_data import generate_synthetic_dataset

    if os.path.exists(RAW_CSV_PATH):
        df = pd.read_csv(
            RAW_CSV_PATH,
            parse_dates=["date"],
        )
    else:
        df = generate_synthetic_dataset()

        os.makedirs(
            os.path.dirname(RAW_CSV_PATH),
            exist_ok=True,
        )

        df.drop(
            columns=["is_synthetic"],
            errors="ignore",
        ).to_csv(
            RAW_CSV_PATH,
            index=False,
        )

    report = ingest_dataframe(
        df,
        db,
        filename="synthetic_freight_data.csv",
        is_synthetic=True,
    )

    return report.rows_inserted


def seed_model_run_history(db):
    """
    Populate model_runs from bundled training metadata.
    """
    meta_dir = os.path.join(
        BACKEND_DIR,
        "data",
        "trained_models",
    )

    if not os.path.isdir(meta_dir):
        return 0

    written = 0

    for horizon in HORIZONS:
        meta_path = os.path.join(
            meta_dir,
            f"model_h{horizon}_meta.json",
        )

        if not os.path.exists(meta_path):
            continue

        try:
            with open(
                meta_path,
                "r",
                encoding="utf-8",
            ) as f:
                meta = json.load(f)

        except (
            OSError,
            ValueError,
            TypeError,
        ):
            continue

        leaderboard = meta.get(
            "leaderboard",
            {},
        )

        for model_name, metrics in leaderboard.items():

            existing = (
                db.execute(
                    select(ModelRun)
                    .where(
                        ModelRun.model_name == model_name,
                        ModelRun.horizon_days == int(horizon),
                    )
                    .order_by(ModelRun.id.asc())
                )
                .scalars()
                .first()
            )

            try:
                values = {
                    "training_start": date_type.fromisoformat(
                        meta["training_start"]
                    ),
                    "training_end": date_type.fromisoformat(
                        meta["training_end"]
                    ),
                    "mae": float(
                        metrics.get("mae", 0)
                    ),
                    "rmse": float(
                        metrics.get("rmse", 0)
                    ),
                    "mape": float(
                        metrics.get("mape", 0)
                    ),
                    "r2": (
                        float(metrics["r2"])
                        if metrics.get("r2") is not None
                        else None
                    ),
                    "training_rows": int(
                        meta.get(
                            "training_rows",
                            0,
                        )
                    ),
                    "horizon_days": int(horizon),
                    "is_best_model": (
                        model_name
                        == meta.get("best_model")
                    ),
                }

            except (
                KeyError,
                TypeError,
                ValueError,
            ):
                continue

            if existing is None:
                db.add(
                    ModelRun(
                        model_name=model_name,
                        **values,
                    )
                )
            else:
                for key, value in values.items():
                    setattr(
                        existing,
                        key,
                        value,
                    )

            written += 1

    if written:
        db.commit()

    return written


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    db = SessionLocal()

    try:
        seed_reference_data(db)
        seed_freight_history_if_empty(db)
        seed_model_run_history(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title="Intelligent Freight Forecasting & Chartering Decision Support",
    description=(
        "SIH 2026 Problem Statement 26006 — backend API. "
        "Zero external APIs: all forecasting/optimization "
        "runs locally against historical + synthetic data "
        "using scikit-learn/XGBoost/LightGBM models."
    ),
    version="1.0.0",
    lifespan=lifespan,
)
# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Current production frontend
        "https://back-nu-seven.vercel.app",

        # Current Vercel deployment / preview
        "https://back-n1rn5l3i3-divyanshu19283-maxs-projects.vercel.app",

        # Other known deployments
        "https://freight-puce.vercel.app",
        "https://freight-sih.vercel.app",
        "https://freight-no7hyyp8j-divyanshu19283-maxs-projects.vercel.app",

        # Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],

    # Allow all Vercel preview deployments
    allow_origin_regex=r"https://.*\.vercel\.app",

    # No cookies/auth credentials are required by this API
    allow_credentials=False,

    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ============================================================
# API ROUTES
# ============================================================

app.include_router(data.router)
app.include_router(forecast.router)
app.include_router(decision.router)
app.include_router(maritime.router)
app.include_router(chat.router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "service": "freight-forecasting-backend",
        "status": "ok",
        "docs": "/docs",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    """
    Reports database connectivity and trained model availability.
    """

    db_status = "disconnected"

    try:
        db = SessionLocal()

        try:
            db.execute(text("SELECT 1"))
            db_status = "connected"
        finally:
            db.close()

    except Exception:
        db_status = "disconnected"

    model_loaded = all(
        os.path.exists(
            os.path.join(
                MODEL_DIR,
                f"model_h{h}.joblib",
            )
        )
        for h in HORIZONS
    )

    return {
        "status": "healthy",
        "database": db_status,
        "model_loaded": model_loaded,
        "version": "1.0.0",
    }

