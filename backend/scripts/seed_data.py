"""
Generates the synthetic dataset, writes it to data/raw/synthetic_freight_data.csv,
initializes the DB schema, and ingests the CSV through the real validation
pipeline (app.services.ingestion) — so the demo data goes through the exact
same path a real uploaded CSV would.

Usage:
    python -m scripts.seed_data
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import init_db, SessionLocal
from app.utils.synthetic_data import generate_synthetic_dataset
from app.services.ingestion import ingest_dataframe

RAW_CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw",
    "synthetic_freight_data.csv",
)


def main():
    print("Generating synthetic dataset...")
    df = generate_synthetic_dataset()
    os.makedirs(os.path.dirname(RAW_CSV_PATH), exist_ok=True)
    df.drop(columns=["is_synthetic"]).to_csv(RAW_CSV_PATH, index=False)
    print(f"  wrote {len(df):,} rows -> {RAW_CSV_PATH}")

    print("Initializing DB schema...")
    init_db()

    print("Ingesting through validation pipeline (is_synthetic=True)...")
    db = SessionLocal()
    try:
        report = ingest_dataframe(df, db, filename="synthetic_freight_data.csv", is_synthetic=True)
    finally:
        db.close()

    print("\n--- Ingestion Report ---")
    for k, v in report.as_dict().items():
        if k == "outlier_examples" and v:
            print(f"  {k}: {len(v)} examples, e.g. {v[0]}")
        else:
            print(f"  {k}: {v}")

    if not report.success:
        print("INGESTION FAILED"); sys.exit(1)
    print(f"\nDone. {report.rows_inserted:,} rows inserted into freight_rates.")


if __name__ == "__main__":
    main()
