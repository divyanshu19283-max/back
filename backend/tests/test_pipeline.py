"""
Test suite for the freight forecasting backend.

Uses a temporary SQLite DB (separate from the dev DB) so tests never
mutate real project data. Run with:

    cd backend && pytest -v
"""
import os
import sys
import tempfile

import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mktemp(suffix='.db')}"

from app.database import Base, engine, SessionLocal, init_db  # noqa: E402
from app.services.ingestion import ingest_dataframe, validate_columns, IngestionReport  # noqa: E402
from app.utils.synthetic_data import generate_synthetic_dataset  # noqa: E402
from app.ml.features import build_features, train_ready_frame, FEATURE_COLUMNS  # noqa: E402
from app.services.decision_engine import evaluate_charter_decision  # noqa: E402
from app.services.optimizer import evaluate_option, _fuel_intensity  # noqa: E402
from app.ml.predict import forecast_route, _build_features_cached  # noqa: E402
from app.ml.train import GROUP_COLS  # noqa: E402


@pytest.fixture(scope="module")
def db_session():
    init_db()
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def small_dataset():
    return generate_synthetic_dataset(start_date="2024-01-01", end_date="2024-06-30")


# ---------------------------------------------------------------------------
# Ingestion pipeline
# ---------------------------------------------------------------------------

def test_validate_columns_missing():
    df = pd.DataFrame({"date": ["2024-01-01"]})
    assert validate_columns(df) is not None


def test_ingest_valid_dataframe(db_session, small_dataset):
    report = ingest_dataframe(small_dataset.copy(), db_session, filename="test.csv", is_synthetic=True)
    assert report.success is True
    assert report.rows_inserted == len(small_dataset)
    assert len(report.errors) == 0


def test_ingest_deduplicates_against_db(db_session, small_dataset):
    # re-ingesting the same data should skip everything as DB duplicates
    report = ingest_dataframe(small_dataset.copy(), db_session, filename="test2.csv", is_synthetic=True)
    assert report.rows_inserted == 0
    assert report.rows_skipped_duplicate_in_db == len(small_dataset)


def test_ingest_handles_missing_and_bad_rows(db_session):
    df = pd.DataFrame({
        "date": ["2024-07-01", "not-a-date", "2024-07-03", "2024-07-04"],
        "origin": ["Australia", "Australia", None, "Australia"],
        "destination": ["East Coast India"] * 4,
        "commodity": ["Coal"] * 4,
        "vessel_type": ["Panamax"] * 4,
        "vessel_size": ["65000-80000 DWT"] * 4,
        "freight_rate": [40.0, 41.0, 42.0, -5.0],  # last is invalid (negative)
        "fuel_price": [600, 610, 615, 620],
        "demand_index": [100, None, 101, 102],  # None should be imputed
        "supply_index": [95, 96, 97, 98],
        "port_congestion_index": [20, 21, 22, 23],
    })
    report = ingest_dataframe(df, db_session, filename="dirty.csv", is_synthetic=True)
    assert report.rows_dropped_bad_date == 1
    assert report.rows_dropped_missing_required == 1
    # negative freight_rate row should be filtered by the sanity-bounds check
    assert report.rows_inserted <= 1


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def test_build_features_creates_expected_columns(small_dataset):
    feat = build_features(small_dataset)
    for col in FEATURE_COLUMNS:
        assert col in feat.columns, f"missing feature column {col}"


def test_train_ready_frame_drops_incomplete_lag_rows(small_dataset):
    feat = build_features(small_dataset)
    ready = train_ready_frame(feat)
    assert ready["lag_30"].isna().sum() == 0
    assert len(ready) < len(feat)  # some rows must have been dropped (early history)


def test_features_do_not_leak_across_groups(small_dataset):
    """lag_1 for the first date of a group must be NaN, not borrowed from
    another route's last row (this would be a leakage bug)."""
    feat = build_features(small_dataset)
    first_rows = feat.groupby(["origin", "vessel_type"], sort=False).head(1)
    assert first_rows["lag_1"].isna().all()


# ---------------------------------------------------------------------------
# Decision engine
# ---------------------------------------------------------------------------

def test_decision_charter_now_on_significant_rise_high_confidence():
    d = evaluate_charter_decision(
        current_rate=40.0, predicted_rate=48.0, lower_bound=46.0, upper_bound=50.0,
        confidence_score=0.9, cargo_quantity=10000,
    )
    assert d.recommendation == "CHARTER_NOW"
    assert d.expected_saving > 0


def test_decision_wait_on_falling_rates():
    d = evaluate_charter_decision(
        current_rate=40.0, predicted_rate=34.0, lower_bound=32.0, upper_bound=36.0,
        confidence_score=0.85, cargo_quantity=10000,
    )
    assert d.recommendation == "WAIT"


def test_decision_wait_monitor_on_flat_forecast():
    d = evaluate_charter_decision(
        current_rate=40.0, predicted_rate=40.3, lower_bound=38.0, upper_bound=42.5,
        confidence_score=0.8, cargo_quantity=10000,
    )
    assert d.recommendation == "WAIT_MONITOR"


def test_decision_does_not_naively_buy_on_any_rise():
    """A rise that's real but backed by low confidence and low risk-adjusted
    saving should NOT trigger CHARTER_NOW — this is the core 'not just BUY
    whenever predicted > current' requirement."""
    d = evaluate_charter_decision(
        current_rate=40.0, predicted_rate=41.0, lower_bound=30.0, upper_bound=52.0,
        confidence_score=0.4, cargo_quantity=10000,
    )
    assert d.recommendation != "CHARTER_NOW"


# ---------------------------------------------------------------------------
# Optimizer
# ---------------------------------------------------------------------------

def test_fuel_intensity_known_vessel_types():
    assert _fuel_intensity("Capesize") < _fuel_intensity("Bulk Carrier")


def test_evaluate_option_charter_now_has_zero_risk_adjustment():
    opt = evaluate_option(
        "charter_now", 0, current_rate=40.0, fuel_price=600,
        cargo_quantity=10000, vessel_type="Panamax",
    )
    assert opt.rate_type == "current"
    assert opt.risk_adjustment == 0.0
    assert opt.total_estimated_cost == opt.freight_cost + opt.fuel_cost


# ---------------------------------------------------------------------------
# Forecast / feature-encoding regression (see app/ml/predict.py fix: the
# categorical encodings must be computed over the FULL pooled history, not
# a route-filtered slice, or every route collapses to encoding 0).
# ---------------------------------------------------------------------------

def test_build_features_cached_uses_full_history_not_a_route_slice(small_dataset):
    """origin_enc (and friends) must vary by the *actual* origin present in
    the full frame — factorizing a single-route slice would give every
    route the same constant code, which is exactly the bug being guarded
    against here."""
    feat_full = _build_features_cached(small_dataset, GROUP_COLS)
    origin_codes = feat_full.groupby("origin")["origin_enc"].unique()
    # With >1 origin in the dataset, factorizing over the full frame must
    # produce more than one distinct code — a route-filtered factorize
    # would degenerate every group to the same single code (0).
    assert small_dataset["origin"].nunique() > 1
    all_codes = {c for codes in origin_codes for c in codes}
    assert len(all_codes) > 1, (
        "origin_enc collapsed to a single value across routes — "
        "build_features is being called on a route-filtered slice again."
    )


def test_build_features_cache_invalidates_on_row_count_change(small_dataset):
    """The identity-keyed cache in predict.py must not silently serve stale
    features if the same dataframe object is mutated (e.g. a fresh
    in-place refresh from data_access.py's TTL cache)."""
    first = _build_features_cached(small_dataset, GROUP_COLS)
    assert first is _build_features_cached(small_dataset, GROUP_COLS)  # cache hit
    mutated = small_dataset.iloc[:-1].copy()  # different object, different length
    second = _build_features_cached(mutated, GROUP_COLS)
    assert len(second) == len(mutated)


def test_forecast_route_returns_positive_rate_and_confidence(small_dataset):
    fc = forecast_route(small_dataset, "Australia", "East Coast India", "Panamax", horizon_days=30)
    assert fc["predicted_rate"] > 0
    assert 0.0 <= fc["confidence_score"] <= 1.0
    assert fc["lower_bound"] <= fc["predicted_rate"] <= fc["upper_bound"]


def test_forecast_route_is_case_and_whitespace_insensitive(small_dataset):
    canonical = forecast_route(small_dataset, "Australia", "East Coast India", "Panamax", horizon_days=30)
    messy = forecast_route(small_dataset, "  AUSTRALIA ", "east coast india", "panamax", horizon_days=30)
    assert canonical["predicted_rate"] == messy["predicted_rate"]
    assert messy["origin"] == "Australia"  # echoes canonical casing from the data


# ---------------------------------------------------------------------------
# API (end-to-end, using TestClient with an isolated DB)
# ---------------------------------------------------------------------------

def test_api_health():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


def test_api_data_summary_reflects_ingested_rows():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/data/summary")
    assert resp.status_code == 200
    assert resp.json()["row_count"] > 0


def test_api_whatif_returns_costcomparison_compatible_results():
    """End-to-end: POST /api/whatif -> 200 with real (non-hardcoded)
    CostComparison-shaped numbers, matching what src/lib/api/whatif.ts
    expects to unpack (scenario_input, forecast, alternative_scenarios,
    best_procurement_option, ...)."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.post("/api/whatif", json={
        "origin": "Australia",
        "destination": "East Coast India",
        "vessel_type": "Panamax",
        "cargo_quantity": 50000,
        "current_freight_rate": 65.96,
        "fuel_price": 620,
        "horizon_days": 30,
        "save_scenario": False,
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # forecast block
    assert body["forecast"]["predicted_rate"] > 0
    assert body["forecast"]["origin"] == "Australia"

    # decision block
    assert body["recommended_action"] in ("CHARTER_NOW", "WAIT_MONITOR", "WAIT")
    assert body["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert isinstance(body["confidence"], float)

    # alternative_scenarios: the four procurement options, all independently
    # computed (not hardcoded/duplicated placeholders)
    options = body["alternative_scenarios"]
    assert set(options.keys()) == {"charter_now", "wait_7_days", "wait_30_days", "wait_90_days"}
    totals = [o["total_estimated_cost"] for o in options.values()]
    assert all(t > 0 for t in totals)
    assert len(set(totals)) > 1, "all option totals identical — looks like hardcoded demo data"
    assert body["best_procurement_option"] in options

    # case-insensitive input must resolve the same as canonical casing
    resp2 = client.post("/api/whatif", json={
        "origin": "AUSTRALIA",
        "destination": "east coast india",
        "vessel_type": "panamax",
        "cargo_quantity": 50000,
        "current_freight_rate": 65.96,
        "fuel_price": 620,
        "horizon_days": 30,
        "save_scenario": False,
    })
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["forecast"]["predicted_rate"] == body["forecast"]["predicted_rate"]


def test_api_integrated_decision_returns_real_results():
    """End-to-end: POST /api/maritime/integrated-decision -> 200 with a real
    (non-hardcoded) recommendation, contract comparison, vessel ranking,
    voyage economics and risk alerts — mirrors what
    src/pages/MaritimeOperations.tsx renders."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.post("/api/maritime/integrated-decision", json={
        "origin_id": "australia",
        "port_id": "paradip",
        "cargo_quantity": 50000,
        "cargo_type": "Coal",
        "current_freight_rate": 65.96,
        "fuel_price": 620,
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["recommendation"]["port"]  # not empty
    # Handysize has zero freight-rate history in the synthetic/ingested
    # dataset, so automatic vessel selection must never recommend it.
    assert body["recommendation"]["vessel_type"] != "Handysize"

    contract_totals = [c["total_cost"] for c in body["contract_options"]]
    assert len(body["contract_options"]) == 4
    assert all(t > 0 for t in contract_totals)
    assert len(set(contract_totals)) > 1, "all contract totals identical — looks hardcoded"

    assert len(body["vessel_ranking"]) >= 1
    assert body["voyage"]["duration_days"]["total_voyage_duration"] > 0
    assert body["idle_management"]["current_idle_days"] >= 0
    assert body["risk_alerts"]  # deterministic engine always returns at least one (LOW/MARKET fallback)
    assert body["data_provenance"]["live_port_feed"] is False

    # Case-insensitive origin_id/port_id, same as /api/whatif's contract.
    resp2 = client.post("/api/maritime/integrated-decision", json={
        "origin_id": "AUSTRALIA",
        "port_id": "Paradip",
        "cargo_quantity": 50000,
        "cargo_type": "Coal",
        "current_freight_rate": 65.96,
        "fuel_price": 620,
    })
    assert resp2.status_code == 200, resp2.text
