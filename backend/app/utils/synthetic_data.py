"""
Synthetic freight-rate dataset generator.

Real Baltic-exchange-grade freight rate history isn't freely available, so
this generates a *structurally realistic* dataset instead of pure random
noise. Freight rate is built as a function of:

    base_rate(route, vessel_type)
      + long-run trend
      + yearly seasonality (higher demand pre-monsoon / festive season restock)
      + fuel price co-movement (bunker cost is a real cost driver of freight)
      + demand/supply imbalance (demand_index - supply_index)
      + port congestion premium
      + occasional demand-spike events (e.g. weather disruption, geopolitical)
      + autoregressive noise (rates don't teleport day to day)

Every row is tagged is_synthetic=True so the pipeline and DB always know
which rows are demo data vs real ingested CSVs (is_synthetic=False).
"""
from __future__ import annotations
import numpy as np
import pandas as pd

RNG_SEED = 42

ROUTES = [
    # (origin, destination) — overseas origins feeding the East Coast of India
    ("Australia", "East Coast India"),
    ("Indonesia", "East Coast India"),
    ("South Africa", "East Coast India"),
    ("Brazil", "East Coast India"),
    ("USA Gulf", "East Coast India"),
]

COMMODITIES = ["Coal", "Iron Ore", "Grain", "Bauxite", "Fertilizer"]

VESSEL_TYPES = ["Bulk Carrier", "Panamax", "Supramax", "Capesize"]
VESSEL_SIZES = {
    "Bulk Carrier": "40000-55000 DWT",
    "Panamax": "65000-80000 DWT",
    "Supramax": "50000-60000 DWT",
    "Capesize": "150000-180000 DWT",
}

# Base $/ton rate per route+vessel_type combo (illustrative, not real market data)
_BASE_RATE = {
    "Australia": 14.0,
    "Indonesia": 9.0,
    "South Africa": 18.0,
    "Brazil": 24.0,
    "USA Gulf": 27.0,
}
_VESSEL_MULTIPLIER = {
    "Bulk Carrier": 1.00,
    "Panamax": 1.12,
    "Supramax": 1.05,
    "Capesize": 0.92,  # economies of scale on very large parcels
}


def generate_synthetic_dataset(
    start_date: str = "2021-01-01",
    end_date: str = "2026-08-24",
    freq: str = "D",
    seed: int = RNG_SEED,
) -> pd.DataFrame:
    """Generate a long-format daily synthetic freight-rate dataset across all
    route x commodity x vessel_type combinations. Returns 20k-90k+ rows
    depending on date range, comfortably inside the 2,000-10,000+ requirement
    per series and well above it in total.
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start_date, end_date, freq=freq)
    n_days = len(dates)

    # Shared macro series reused across routes so relationships stay coherent
    day_idx = np.arange(n_days)

    # Long-run fuel price trend (bunker/VLSFO $/ton) with a slow upward drift,
    # a couple of shock periods, and autoregressive noise.
    fuel_trend = 500 + 0.03 * day_idx
    fuel_shocks = np.zeros(n_days)
    shock_days = rng.choice(n_days, size=max(3, n_days // 400), replace=False)
    for sd in shock_days:
        width = rng.integers(20, 60)
        magnitude = rng.uniform(40, 160) * rng.choice([-1, 1])
        end = min(n_days, sd + width)
        ramp = np.linspace(0, magnitude, end - sd)
        fuel_shocks[sd:end] += ramp
    fuel_noise = np.cumsum(rng.normal(0, 1.5, n_days))
    fuel_price = fuel_trend + fuel_shocks + fuel_noise
    fuel_price = np.clip(fuel_price, 300, None)

    # Yearly seasonality for demand (pre-monsoon build + festive-season restock)
    day_of_year = dates.dayofyear.values
    seasonal_demand = 8 * np.sin(2 * np.pi * (day_of_year - 60) / 365.25)

    # Demand index baseline + seasonality + AR noise + occasional spikes
    demand_ar = np.cumsum(rng.normal(0, 0.6, n_days))
    demand_index = 100 + seasonal_demand + demand_ar
    spike_days = rng.choice(n_days, size=max(4, n_days // 300), replace=False)
    for spd in spike_days:
        width = rng.integers(5, 20)
        magnitude = rng.uniform(15, 40)
        end = min(n_days, spd + width)
        bump = magnitude * np.exp(-np.linspace(0, 3, end - spd))
        demand_index[spd:end] += bump

    # Supply index — vessel availability; mean reverting, mildly anti-correlated
    # with demand during spikes (owners can't add capacity instantly)
    supply_ar = np.cumsum(rng.normal(0, 0.5, n_days))
    supply_index = 100 + supply_ar - 0.15 * (demand_index - 100)

    # Port congestion index — correlated with demand spikes + own AR process
    congestion_ar = np.cumsum(rng.normal(0, 0.4, n_days))
    port_congestion_index = 20 + 0.25 * (demand_index - 100) + congestion_ar
    port_congestion_index = np.clip(port_congestion_index, 0, None)

    macro = pd.DataFrame(
        {
            "date": dates,
            "fuel_price": fuel_price,
            "demand_index": demand_index,
            "supply_index": supply_index,
            "port_congestion_index": port_congestion_index,
        }
    )

    frames = []
    combo_seed = seed
    for origin, destination in ROUTES:
        base = _BASE_RATE[origin]
        # small route-specific long-run trend (freight inflation)
        route_trend = rng.uniform(0.0006, 0.0018)
        for vessel_type in VESSEL_TYPES:
            combo_seed += 1
            local_rng = np.random.default_rng(combo_seed)
            commodity = local_rng.choice(COMMODITIES)
            vmult = _VESSEL_MULTIPLIER[vessel_type]

            trend_component = base * vmult * (1 + route_trend * day_idx)
            fuel_component = 0.018 * (macro["fuel_price"].values - 500)
            demand_supply_gap = macro["demand_index"].values - macro["supply_index"].values
            balance_component = 0.06 * demand_supply_gap
            congestion_component = 0.03 * macro["port_congestion_index"].values

            # autoregressive idiosyncratic noise so day-to-day moves are smooth,
            # not iid random
            noise = np.zeros(n_days)
            eps = local_rng.normal(0, 0.35, n_days)
            for t in range(1, n_days):
                noise[t] = 0.85 * noise[t - 1] + eps[t]

            rate = (
                trend_component
                + fuel_component
                + balance_component
                + congestion_component
                + noise
            )
            rate = np.clip(rate, 2.0, None)

            df = macro.copy()
            df["origin"] = origin
            df["destination"] = destination
            df["commodity"] = commodity
            df["vessel_type"] = vessel_type
            df["vessel_size"] = VESSEL_SIZES[vessel_type]
            df["freight_rate"] = np.round(rate, 2)
            df["fuel_price"] = np.round(df["fuel_price"], 2)
            df["demand_index"] = np.round(df["demand_index"], 2)
            df["supply_index"] = np.round(df["supply_index"], 2)
            df["port_congestion_index"] = np.round(df["port_congestion_index"], 2)
            frames.append(df)

    out = pd.concat(frames, ignore_index=True)
    out["is_synthetic"] = True
    col_order = [
        "date", "origin", "destination", "commodity", "vessel_type", "vessel_size",
        "freight_rate", "fuel_price", "demand_index", "supply_index",
        "port_congestion_index", "is_synthetic",
    ]
    out = out[col_order].sort_values(["origin", "vessel_type", "date"]).reset_index(drop=True)
    return out


if __name__ == "__main__":
    df = generate_synthetic_dataset()
    print(df.shape)
    print(df.head())
    print(df.groupby(["origin", "vessel_type"]).size())
