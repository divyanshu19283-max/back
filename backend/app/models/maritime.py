"""ORM models for port and vessel master data.

Mirrors app/data/ports.py and app/data/vessels.py so the reference data is
queryable from the DB (SQLite dev / Supabase PostgreSQL prod alike). List
fields are stored as JSON-encoded text for dialect portability.
"""
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Integer, Text, DateTime

from app.database import Base


class Port(Base):
    __tablename__ = "ports"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False, index=True)
    state = Column(String(64), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    max_draft = Column(Float, nullable=False)
    max_loa = Column(Float, nullable=False)
    max_beam = Column(Float, nullable=False)
    berth_capacity = Column(Integer, nullable=False)
    cargo_types_supported = Column(Text, nullable=False)   # JSON array
    cargo_handling_rate = Column(Float, nullable=False)    # tonnes/day
    max_vessel_size = Column(Float, nullable=False)        # DWT
    congestion_index = Column(Float, nullable=False)       # 0-100
    berth_utilization = Column(Float, nullable=False)      # 0-1
    turnaround_time = Column(Float, nullable=False)        # days
    anchorage_wait_time = Column(Float, nullable=False)    # days
    restrictions = Column(Text, nullable=False)            # JSON array
    operating_status = Column(String(32), nullable=False)
    data_source = Column(String(128), nullable=False)
    data_timestamp = Column(String(64), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Vessel(Base):
    __tablename__ = "vessels"

    id = Column(String(64), primary_key=True)
    vessel_type = Column(String(64), nullable=False, index=True)
    dwt = Column(Float, nullable=False)
    loa = Column(Float, nullable=False)
    beam = Column(Float, nullable=False)
    draft = Column(Float, nullable=False)
    cargo_capacity = Column(Float, nullable=False)
    cargo_types = Column(Text, nullable=False)             # JSON array
    fuel_consumption = Column(Float, nullable=False)       # t/day laden
    speed = Column(Float, nullable=False)                  # knots
    daily_opex = Column(Float, nullable=False)
    daily_charter_rate = Column(Float, nullable=False)
    loading_rate = Column(Float, nullable=False)
    discharge_rate = Column(Float, nullable=False)
    ballast_speed = Column(Float, nullable=False)
    laden_speed = Column(Float, nullable=False)
    emissions_factor = Column(Float, nullable=False)
    data_source = Column(String(128), nullable=False)
    data_timestamp = Column(String(64), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
