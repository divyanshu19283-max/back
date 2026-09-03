"""Reads data/trained_models/model_h{H}_meta.json for each horizon and writes
a row per model into model_runs (one row for every candidate that was
evaluated, flagging the deployed one), so the DB has a full training/eval
audit trail as required by the schema."""
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, init_db
from app.models.freight import ModelRun
from app.ml.train import MODEL_DIR, HORIZONS


def main():
    init_db()
    db = SessionLocal()
    try:
        for h in HORIZONS:
            meta_path = os.path.join(MODEL_DIR, f"model_h{h}_meta.json")
            with open(meta_path) as f:
                meta = json.load(f)
            for model_name, metrics in meta["leaderboard"].items():
                run = ModelRun(
                    model_name=model_name,
                    training_start=datetime.strptime(meta["training_start"], "%Y-%m-%d").date(),
                    training_end=datetime.strptime(meta["training_end"], "%Y-%m-%d").date(),
                    mae=metrics["mae"],
                    rmse=metrics["rmse"],
                    mape=metrics["mape"],
                    r2=metrics["r2"],
                    training_rows=meta["training_rows"],
                    horizon_days=h,
                    is_best_model=(model_name == meta["best_model"]),
                )
                db.add(run)
        db.commit()
        print("model_runs recorded for horizons:", HORIZONS)
    finally:
        db.close()


if __name__ == "__main__":
    main()
