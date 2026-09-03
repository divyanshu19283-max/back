"""
SQLAlchemy ORM models mirroring app/sql/schema.sql.

These are dialect-agnostic and work against both the local SQLite dev DB
and the Supabase PostgreSQL production DB.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Text, Index, Boolean
)
from app.database import Base


class FreightRate(Base):
    __tablename__ = "freight_rates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    origin = Column(String(64), nullable=False, index=True)
    destination = Column(String(64), nullable=False, index=True)
    commodity = Column(String(64), nullable=False)
    vessel_type = Column(String(32), nullable=False, index=True)
    vessel_size = Column(String(32), nullable=False)
    freight_rate = Column(Float, nullable=False)
    fuel_price = Column(Float, nullable=False)
    demand_index = Column(Float, nullable=False)
    supply_index = Column(Float, nullable=False)
    port_congestion_index = Column(Float, nullable=False)
    is_synthetic = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_freight_route_date", "origin", "destination", "vessel_type", "date"),
    )


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    forecast_date = Column(Date, nullable=False, index=True)
    origin = Column(String(64), nullable=False)
    destination = Column(String(64), nullable=False)
    vessel_type = Column(String(32), nullable=False)
    horizon_days = Column(Integer, nullable=False, default=7)
    predicted_rate = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=False)
    upper_bound = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    model_name = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_forecast_route", "origin", "destination", "vessel_type", "forecast_date"),
    )


class CharterRecommendation(Base):
    __tablename__ = "charter_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    origin = Column(String(64), nullable=False)
    destination = Column(String(64), nullable=False)
    cargo_quantity = Column(Float, nullable=False)
    vessel_size = Column(String(32), nullable=False)
    current_rate = Column(Float, nullable=False)
    predicted_rate = Column(Float, nullable=False)
    estimated_cost_now = Column(Float, nullable=False)
    estimated_cost_later = Column(Float, nullable=False)
    expected_saving = Column(Float, nullable=False)
    recommendation = Column(String(32), nullable=False)
    reason = Column(Text, nullable=True)
    risk_level = Column(String(16), nullable=True)
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ModelRun(Base):
    __tablename__ = "model_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String(64), nullable=False)
    training_start = Column(Date, nullable=False)
    training_end = Column(Date, nullable=False)
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    mape = Column(Float, nullable=False)
    r2 = Column(Float, nullable=True)
    training_rows = Column(Integer, nullable=False)
    horizon_days = Column(Integer, nullable=False, default=7)
    is_best_model = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    origin = Column(String(64), nullable=False)
    destination = Column(String(64), nullable=False)
    cargo_quantity = Column(Float, nullable=False)
    vessel_size = Column(String(32), nullable=False)
    current_rate = Column(Float, nullable=False)
    fuel_price = Column(Float, nullable=False)
    predicted_rate = Column(Float, nullable=False)
    recommendation = Column(String(32), nullable=False)
    estimated_savings = Column(Float, nullable=False)
    result_json = Column(Text, nullable=True)  # full what-if payload for audit/replay
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
