// Clearly-labeled illustrative data used ONLY when the backend is unreachable.
// Every consumer must mark these values as "Demo" — never mix with live values.

import type {
  DataSummary,
  EDAStats,
  ForecastResult,
  WhatIfResult,
  OptimizeResult,
  RecommendationHistoryItem,
  ScenarioHistoryItem,
  ModelRun,
  ForecastHistoryItem,
} from "./types";

// NOTE: there used to be a DEMO_ROUTES constant here with illustrative
// origin/destination combinations (e.g. China, Europe, West Coast India)
// that do not exist in the real freight dataset. It was never wired to
// useRoutes() or any UI — route/vessel choices always come from the live
// backend (see hooks.ts useRoutes) so a forecast/optimize request can never
// be built against a fake destination. It has been removed rather than kept
// around unused, since dead fake-destination data is exactly what this
// module's contract ("every consumer must mark these as Demo") is meant to
// prevent from leaking into a real request path.

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

function buildForecastSeries(
  current: number,
  drift: number,
  horizon: number,
  noise = 0.012,
): {
  date: string;
  historical: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
}[] {
  const series: {
    date: string;
    historical: number | null;
    forecast: number | null;
    lower: number | null;
    upper: number | null;
  }[] = [];
  // 60 days of "historical" ending today
  for (let i = -60; i < 0; i++) {
    const t = i + 60;
    const seasonal = Math.sin(t / 9) * 1.4;
    const trend = (t / 60) * 2.2;
    const jitter = (pseudo(i) - 0.5) * 2.4;
    series.push({
      date: addDays(i),
      historical: Math.max(8, +(current - 2.2 + trend + seasonal + jitter).toFixed(2)),
      forecast: null,
      lower: null,
      upper: null,
    });
  }
  // forecast horizon
  for (let i = 0; i < horizon; i++) {
    const trend = drift * (i / horizon);
    const seasonal = Math.sin((i + 60) / 9) * 1.2;
    const jitter = (pseudo(i + 200) - 0.5) * 1.6;
    const f = +(current + trend + seasonal + jitter).toFixed(2);
    const spread = +(1.4 + i * 0.04).toFixed(2);
    series.push({
      date: addDays(i),
      historical: null,
      forecast: f,
      lower: +(f - spread).toFixed(2),
      upper: +(f + spread).toFixed(2),
    });
  }
  return series;
}

// deterministic pseudo-random so the demo chart is stable across renders
function pseudo(seed: number): number {
  const x = Math.sin(seed * 99.13) * 10000;
  return x - Math.floor(x);
}

export const DEMO_SUMMARY: DataSummary = {
  dataset_size: 12480,
  routes: 18,
  date_range: { start: "2019-01-02", end: "2024-12-30" },
  avg_freight_rate: 62.4,
  min_freight_rate: 18.2,
  max_freight_rate: 119.6,
  vessel_types: ["PANAMAX", "HANDYSIZE", "SUPRAMAX", "CAPE"],
  origins: ["AUSTRALIA", "BRAZIL", "USA", "SOUTH AFRICA", "INDONESIA"],
};

export const DEMO_EDA: EDAStats = {
  rate_distribution: [
    { bin: "10-20", count: 410 },
    { bin: "20-30", count: 980 },
    { bin: "30-40", count: 1620 },
    { bin: "40-50", count: 2310 },
    { bin: "50-60", count: 2980 },
    { bin: "60-70", count: 2440 },
    { bin: "70-80", count: 1180 },
    { bin: "80-90", count: 620 },
    { bin: "90-100", count: 540 },
    { bin: "100-110", count: 280 },
    { bin: "110-120", count: 120 },
  ],
  route_distribution: [
    { route: "AUSTRALIA → EAST COAST INDIA", count: 1820 },
    { route: "BRAZIL → EAST COAST INDIA", count: 1640 },
    { route: "USA → WEST COAST INDIA", count: 1410 },
    { route: "SOUTH AFRICA → EAST COAST INDIA", count: 1280 },
    { route: "INDONESIA → EAST COAST INDIA", count: 1120 },
    { route: "AUSTRALIA → CHINA", count: 980 },
    { route: "BRAZIL → CHINA", count: 860 },
    { route: "USA → CHINA", count: 720 },
  ],
  historical_trend: Array.from({ length: 48 }, (_, i) => {
    const d = new Date(2021, 0, 1);
    d.setMonth(d.getMonth() + i);
    const t = i / 47;
    const seasonal = Math.sin(i / 3.2) * 9;
    const trend = t * 18;
    return {
      date: d.toISOString().slice(0, 7),
      rate: +(45 + trend + seasonal + (pseudo(i) - 0.5) * 4).toFixed(1),
    };
  }),
  vessel_distribution: [
    { vessel: "PANAMAX", count: 4120 },
    { vessel: "HANDYSIZE", count: 3280 },
    { vessel: "SUPRAMAX", count: 2960 },
    { vessel: "CAPE", count: 2120 },
  ],
  summary: {
    mean: 62.4,
    median: 61.1,
    std: 17.8,
    skew: 0.42,
    kurtosis: 2.1,
  },
};

export function buildDemoForecast(
  origin = "AUSTRALIA",
  destination = "EAST COAST INDIA",
  vessel = "PANAMAX",
  horizon = 30,
): ForecastResult {
  const current = 65.96;
  const predicted = horizon === 7 ? 66.8 : horizon === 90 ? 69.4 : 67.42;
  const expectedChange = +(((predicted - current) / current) * 100).toFixed(1);
  const spread = horizon === 7 ? 1.2 : horizon === 90 ? 3.4 : 2.1;
  return {
    origin,
    destination,
    vessel,
    horizon,
    predicted_rate: predicted,
    lower_bound: +(predicted - spread).toFixed(2),
    upper_bound: +(predicted + spread).toFixed(2),
    confidence: horizon === 7 ? 93.2 : horizon === 90 ? 81.4 : 88.1,
    model: "Gradient Boosting",
    as_of: iso(today),
    current_rate: current,
    expected_change_pct: expectedChange,
    series: buildForecastSeries(current, predicted - current, horizon),
    reason:
      "Model projects a modest upward drift over the horizon driven by seasonal demand and tightening vessel availability. Confidence remains high but narrows with time.",
  };
}

export function buildDemoWhatIf(input: {
  cargo_quantity: number;
  current_freight_rate: number;
  fuel_price: number;
  horizon?: number;
}): WhatIfResult {
  const qty = input.cargo_quantity;
  const rate = input.current_freight_rate;
  const fuel = input.fuel_price;
  const base = qty * rate;
  const mk = (label: string, futureRate: number, riskAdj: number) => {
    const freight = qty * futureRate;
    const fuelCost =
      (qty / 50) *
      fuel *
      (label === "CHARTER NOW"
        ? 1
        : 1 + (label.includes("90") ? 0.06 : label.includes("30") ? 0.03 : 0.01));
    const risk = (freight + fuelCost) * riskAdj;
    const total = freight + fuelCost + risk;
    return {
      label,
      freight_cost: +freight.toFixed(0),
      fuel_cost: +fuelCost.toFixed(0),
      risk_adjustment: +risk.toFixed(0),
      total: +total.toFixed(0),
      savings: +Math.max(0, total - base).toFixed(0),
    };
  };
  return {
    options: [
      mk("CHARTER NOW", rate, 0.0),
      mk("WAIT 7 DAYS", rate * 1.011, 0.005),
      mk("WAIT 30 DAYS", rate * 1.036, 0.018),
      mk("WAIT 90 DAYS", rate * 1.054, 0.032),
    ],
    recommended: "WAIT & MONITOR",
    cargo_quantity: qty,
    fuel_price: fuel,
    horizon: input.horizon ?? 30,
  };
}

export const DEMO_OPTIMIZE: OptimizeResult = {
  options: [
    {
      rank: 1,
      action: "CHARTER NOW",
      label: "Charter Now",
      description: "Best current option — locks rate, zero exposure.",
      total_cost: 3608000,
      risk: "LOW",
      confidence: 92.4,
      savings: 0,
    },
    {
      rank: 2,
      action: "WAIT 7 DAYS",
      label: "Wait 7 Days",
      description: "Moderate risk — small projected upside.",
      total_cost: 3696000,
      risk: "MEDIUM",
      confidence: 88.1,
      savings: -88000,
    },
    {
      rank: 3,
      action: "WAIT 30 DAYS",
      label: "Wait 30 Days",
      description: "Higher projected cost — trend moves against you.",
      total_cost: 3821000,
      risk: "MEDIUM",
      confidence: 84.2,
      savings: -213000,
    },
    {
      rank: 4,
      action: "WAIT 90 DAYS",
      label: "Wait 90 Days",
      description: "Highest modeled exposure — avoid unless hedged.",
      total_cost: 3863000,
      risk: "HIGH",
      confidence: 79.6,
      savings: -255000,
    },
  ],
  recommended: "CHARTER NOW",
  origin: "AUSTRALIA",
  destination: "EAST COAST INDIA",
  vessel: "PANAMAX",
};

export const DEMO_RECOMMENDATIONS: RecommendationHistoryItem[] = [
  {
    id: 1,
    date: "2026-08-21",
    origin: "AUSTRALIA",
    destination: "EAST COAST INDIA",
    vessel: "PANAMAX",
    action: "WAIT & MONITOR",
    confidence: 88.1,
    risk: "MEDIUM",
    savings: 73000,
  },
  {
    id: 2,
    date: "2026-08-18",
    origin: "BRAZIL",
    destination: "EAST COAST INDIA",
    vessel: "CAPE",
    action: "CHARTER NOW",
    confidence: 91.4,
    risk: "LOW",
    savings: 0,
  },
  {
    id: 3,
    date: "2026-08-15",
    origin: "USA",
    destination: "WEST COAST INDIA",
    vessel: "SUPRAMAX",
    action: "WAIT 7 DAYS",
    confidence: 84.0,
    risk: "MEDIUM",
    savings: 41000,
  },
  {
    id: 4,
    date: "2026-08-12",
    origin: "SOUTH AFRICA",
    destination: "EAST COAST INDIA",
    vessel: "HANDYSIZE",
    action: "WAIT & MONITOR",
    confidence: 79.6,
    risk: "MEDIUM",
    savings: 28000,
  },
  {
    id: 5,
    date: "2026-08-09",
    origin: "INDONESIA",
    destination: "EAST COAST INDIA",
    vessel: "PANAMAX",
    action: "CHARTER NOW",
    confidence: 89.2,
    risk: "LOW",
    savings: 0,
  },
  {
    id: 6,
    date: "2026-08-05",
    origin: "AUSTRALIA",
    destination: "CHINA",
    vessel: "CAPE",
    action: "WAIT 30 DAYS",
    confidence: 76.4,
    risk: "HIGH",
    savings: -120000,
  },
];

export const DEMO_SCENARIOS: ScenarioHistoryItem[] = [
  {
    id: 1,
    date: "2026-08-21",
    route: "AUSTRALIA → EAST COAST INDIA",
    vessel: "PANAMAX",
    action: "WAIT & MONITOR",
    confidence: 88.1,
    risk: "MEDIUM",
    savings: 73000,
  },
  {
    id: 2,
    date: "2026-08-18",
    route: "BRAZIL → EAST COAST INDIA",
    vessel: "CAPE",
    action: "CHARTER NOW",
    confidence: 91.4,
    risk: "LOW",
    savings: 0,
  },
  {
    id: 3,
    date: "2026-08-15",
    route: "USA → WEST COAST INDIA",
    vessel: "SUPRAMAX",
    action: "WAIT 7 DAYS",
    confidence: 84.0,
    risk: "MEDIUM",
    savings: 41000,
  },
  {
    id: 4,
    date: "2026-08-12",
    route: "SOUTH AFRICA → EAST COAST INDIA",
    vessel: "HANDYSIZE",
    action: "WAIT & MONITOR",
    confidence: 79.6,
    risk: "MEDIUM",
    savings: 28000,
  },
  {
    id: 5,
    date: "2026-08-09",
    route: "INDONESIA → EAST COAST INDIA",
    vessel: "PANAMAX",
    action: "CHARTER NOW",
    confidence: 89.2,
    risk: "LOW",
    savings: 0,
  },
];

export const DEMO_MODEL_RUNS: ModelRun[] = [
  {
    id: 1,
    horizon: 7,
    model: "Gradient Boosting",
    mae: 1.42,
    rmse: 1.88,
    mape: 2.31,
    r2: 0.964,
    created_at: "2026-08-20",
  },
  {
    id: 2,
    horizon: 7,
    model: "XGBoost",
    mae: 1.51,
    rmse: 1.97,
    mape: 2.44,
    r2: 0.958,
    created_at: "2026-08-20",
  },
  {
    id: 3,
    horizon: 7,
    model: "Random Forest",
    mae: 1.68,
    rmse: 2.12,
    mape: 2.71,
    r2: 0.949,
    created_at: "2026-08-20",
  },
  {
    id: 4,
    horizon: 7,
    model: "LightGBM",
    mae: 1.46,
    rmse: 1.91,
    mape: 2.36,
    r2: 0.962,
    created_at: "2026-08-20",
  },
  {
    id: 5,
    horizon: 7,
    model: "Naive Persistence",
    mae: 3.84,
    rmse: 4.62,
    mape: 6.18,
    r2: 0.712,
    created_at: "2026-08-20",
  },
  {
    id: 6,
    horizon: 7,
    model: "Moving Average",
    mae: 3.21,
    rmse: 3.98,
    mape: 5.24,
    r2: 0.761,
    created_at: "2026-08-20",
  },
  {
    id: 7,
    horizon: 30,
    model: "Gradient Boosting",
    mae: 2.84,
    rmse: 3.61,
    mape: 4.42,
    r2: 0.881,
    created_at: "2026-08-20",
  },
  {
    id: 8,
    horizon: 30,
    model: "XGBoost",
    mae: 2.91,
    rmse: 3.72,
    mape: 4.51,
    r2: 0.876,
    created_at: "2026-08-20",
  },
  {
    id: 9,
    horizon: 30,
    model: "Random Forest",
    mae: 3.12,
    rmse: 3.94,
    mape: 4.82,
    r2: 0.864,
    created_at: "2026-08-20",
  },
  {
    id: 10,
    horizon: 30,
    model: "LightGBM",
    mae: 2.88,
    rmse: 3.66,
    mape: 4.46,
    r2: 0.879,
    created_at: "2026-08-20",
  },
  {
    id: 11,
    horizon: 30,
    model: "Naive Persistence",
    mae: 6.42,
    rmse: 7.81,
    mape: 9.92,
    r2: 0.421,
    created_at: "2026-08-20",
  },
  {
    id: 12,
    horizon: 30,
    model: "Moving Average",
    mae: 5.74,
    rmse: 7.02,
    mape: 8.84,
    r2: 0.514,
    created_at: "2026-08-20",
  },
  {
    id: 13,
    horizon: 90,
    model: "Gradient Boosting",
    mae: 4.21,
    rmse: 5.42,
    mape: 6.71,
    r2: 0.742,
    created_at: "2026-08-20",
  },
  {
    id: 14,
    horizon: 90,
    model: "XGBoost",
    mae: 4.32,
    rmse: 5.58,
    mape: 6.88,
    r2: 0.734,
    created_at: "2026-08-20",
  },
  {
    id: 15,
    horizon: 90,
    model: "Random Forest",
    mae: 4.61,
    rmse: 5.92,
    mape: 7.24,
    r2: 0.718,
    created_at: "2026-08-20",
  },
  {
    id: 16,
    horizon: 90,
    model: "LightGBM",
    mae: 4.28,
    rmse: 5.51,
    mape: 6.79,
    r2: 0.739,
    created_at: "2026-08-20",
  },
  {
    id: 17,
    horizon: 90,
    model: "Naive Persistence",
    mae: 9.84,
    rmse: 11.92,
    mape: 15.41,
    r2: 0.182,
    created_at: "2026-08-20",
  },
  {
    id: 18,
    horizon: 90,
    model: "Moving Average",
    mae: 8.92,
    rmse: 10.74,
    mape: 13.88,
    r2: 0.284,
    created_at: "2026-08-20",
  },
];

export const DEMO_FORECAST_HISTORY: ForecastHistoryItem[] = [
  {
    id: 1,
    created_at: "2026-08-21T10:24:00",
    origin: "AUSTRALIA",
    destination: "EAST COAST INDIA",
    vessel: "PANAMAX",
    horizon: 30,
    predicted_rate: 67.42,
    confidence: 88.1,
    model: "Gradient Boosting",
  },
  {
    id: 2,
    created_at: "2026-08-18T09:12:00",
    origin: "BRAZIL",
    destination: "EAST COAST INDIA",
    vessel: "CAPE",
    horizon: 7,
    predicted_rate: 71.2,
    confidence: 91.4,
    model: "Gradient Boosting",
  },
  {
    id: 3,
    created_at: "2026-08-15T14:48:00",
    origin: "USA",
    destination: "WEST COAST INDIA",
    vessel: "SUPRAMAX",
    horizon: 30,
    predicted_rate: 58.4,
    confidence: 84.0,
    model: "XGBoost",
  },
  {
    id: 4,
    created_at: "2026-08-12T11:30:00",
    origin: "SOUTH AFRICA",
    destination: "EAST COAST INDIA",
    vessel: "HANDYSIZE",
    horizon: 90,
    predicted_rate: 49.8,
    confidence: 79.6,
    model: "Gradient Boosting",
  },
];
