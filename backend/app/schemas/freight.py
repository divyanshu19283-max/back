from typing import Optional
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    origin: str
    destination: str = "East Coast India"
    vessel_type: str
    horizon_days: int = Field(30, description="7, 30, or 90 (nearest supported horizon is used)")


class WhatIfRequest(BaseModel):
    origin: str
    destination: str = "East Coast India"
    vessel_type: str
    cargo_quantity: float = Field(..., gt=0)
    current_freight_rate: float = Field(..., gt=0)
    fuel_price: float = Field(..., gt=0)
    horizon_days: int = 30
    save_scenario: bool = True


class OptimizeRequest(BaseModel):
    origin: str
    destination: str = "East Coast India"
    vessel_type: str
    cargo_quantity: float = Field(..., gt=0)
    current_freight_rate: float = Field(..., gt=0)
    fuel_price: float = Field(..., gt=0)
