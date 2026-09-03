// Shared API types — mirror the backend payloads used across the app.

export type VesselType = "PANAMAX" | "HANDYSIZE" | "SUPRAMAX" | "CAPE" | "VLCC" | string;

export interface RouteOption {
  origin: string;
  destinations: string[];
}

export interface RoutesResponse {
  routes: RouteOption[];
  vessel_types: string[];
  /** Exact origin + destination + vessel combinations returned by the backend. */
  combinations?: BackendRouteRow[];
}

export interface HealthResponse {
  status: string;
  database?: string;
  model_loaded?: boolean;
  version?: string;
}

export interface DataSummary {
  dataset_size: number;
  routes: number;
  date_range: { start: string; end: string };
  avg_freight_rate: number;
  min_freight_rate: number;
  max_freight_rate: number;
  vessel_types: string[];
  origins: string[];
}

export interface EDAStats {
  rate_distribution?: Array<{ bin: string; count: number }>;
  route_distribution?: Array<{ route: string; count: number }>;
  historical_trend?: Array<{ date: string; rate: number }>;
  vessel_distribution?: Array<{ vessel: string; count: number }>;
  summary?: Record<string, number | string>;
}

export interface ForecastPoint {
  date: string;
  historical?: number | null;
  forecast?: number | null;
  lower?: number | null;
  upper?: number | null;
}

export interface ForecastResult {
  origin: string;
  destination: string;
  vessel: string;
  horizon: number;
  predicted_rate: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
  model: string;
  as_of: string;
  current_rate: number;
  expected_change_pct: number;
  series: ForecastPoint[];
  reason?: string;
}

export interface ForecastHistoryItem {
  id: number;
  created_at: string;
  origin: string;
  destination: string;
  vessel: string;
  horizon: number;
  predicted_rate: number;
  confidence: number;
  model: string;
}

export interface WhatIfInput {
  cargo_quantity: number;
  current_freight_rate: number;
  fuel_price: number;
  route?: string;
  vessel?: string;
  horizon?: number;
}

export interface WhatIfOption {
  label: string;
  freight_cost: number;
  fuel_cost: number;
  risk_adjustment: number;
  total: number;
  savings: number;
}

export interface WhatIfResult {
  options: WhatIfOption[];
  recommended: string;
  cargo_quantity: number;
  fuel_price: number;
  horizon: number;
}

export interface OptimizeOption {
  rank: number;
  action: string;
  label: string;
  description: string;
  total_cost: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  savings: number;
}

export interface OptimizeResult {
  options: OptimizeOption[];
  recommended: string;
  origin: string;
  destination: string;
  vessel: string;
}

export interface RecommendationHistoryItem {
  id: number;
  date: string;
  origin: string;
  destination: string;
  vessel: string;
  action: string;
  confidence: number;
  risk: string;
  savings: number;
}

export interface ScenarioHistoryItem {
  id: number;
  date: string;
  route: string;
  vessel: string;
  action: string;
  confidence: number;
  risk: string;
  savings: number;
}

export interface ModelRun {
  id: number;
  horizon: number;
  model: string;
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
  created_at: string;
  is_best_model?: boolean;
}

export type ApiError = {
  status: "offline" | "error" | "no-data" | "server" | "unknown";
  message: string;
};

// ---------------------------------------------------------------------
// Raw backend response shapes (freight-navigator FastAPI). These mirror
// the actual JSON the backend returns, verified against the live server —
// they intentionally do NOT match the frontend-facing types above. Each
// api/*.ts module adapts one of these into the corresponding frontend type
// so components never see the backend's native shape.
// ---------------------------------------------------------------------

export interface BackendHealth {
  status: string;
  database?: "connected" | "disconnected";
  model_loaded?: boolean;
  version?: string;
}

export interface BackendRouteRow {
  origin: string;
  destination: string;
  vessel_type: string;
  rows: number;
}

export interface BackendRoutesResponse {
  routes: BackendRouteRow[];
}

export interface BackendSummary {
  row_count: number;
  synthetic_rows: number;
  real_rows: number;
  date_range: { start: string; end: string };
  origins: string[];
  destinations: string[];
  vessel_types: string[];
  route_count?: number;
  avg_freight_rate?: number;
  min_freight_rate?: number;
  max_freight_rate?: number;
  message?: string;
}

export interface BackendEda {
  row_count: number;
  date_range: { start: string; end: string };
  synthetic_rows: number;
  real_rows: number;
  overall?: Record<string, number>;
  monthly_avg_freight_rate?: Record<string, number>;
  yearly_avg_freight_rate?: Record<string, number>;
  origin_avg_freight_rate?: Record<string, number>;
  vessel_type_comparison?: Record<string, { mean: number; median: number; std: number }>;
  correlation_with_freight_rate?: Record<string, number>;
  rate_distribution?: Array<{ bin: string; count: number }>;
  route_distribution?: Array<{ route: string; count: number }>;
  historical_trend?: Array<{ date: string; rate: number }>;
  vessel_distribution?: Array<{ vessel: string; count: number }>;
  error?: string;
}

export interface BackendHistoryPoint {
  date: string;
  rate: number;
}

export interface BackendHistoryResponse {
  origin: string;
  destination: string;
  vessel_type: string;
  points: BackendHistoryPoint[];
}

export interface BackendForecastResult {
  origin: string;
  destination: string;
  vessel_type: string;
  horizon_days: number;
  model_horizon_used: number;
  forecast_date: string;
  predicted_rate: number;
  lower_bound: number;
  upper_bound: number;
  confidence_score: number;
  model_name: string;
  current_rate: number;
  as_of_date: string;
}

export interface BackendForecastHistoryItem {
  id: number;
  created_at: string;
  origin: string;
  destination: string;
  vessel_type: string;
  horizon_days: number;
  predicted_rate: number;
  confidence_score: number;
  model_name: string;
  forecast_date: string;
  lower_bound: number;
  upper_bound: number;
}

export interface BackendOptionResult {
  option: string;
  horizon_days: number;
  rate_used: number;
  rate_type: "current" | "predicted";
  confidence: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  freight_cost: number;
  fuel_cost: number;
  risk_adjustment: number;
  total_estimated_cost: number;
}

export interface BackendOptimizeResult {
  origin: string;
  destination: string;
  vessel_type: string;
  cargo_quantity: number;
  options: Record<string, BackendOptionResult>;
  best_option: string;
  savings_vs_charter_now: number;
  assumptions: Record<string, unknown>;
}

export interface BackendWhatIfResult {
  scenario_input: {
    origin: string;
    destination: string;
    vessel_type: string;
    cargo_quantity: number;
    current_freight_rate: number;
    fuel_price: number;
    horizon_days: number;
  };
  forecast: BackendForecastResult;
  recommended_action: string;
  reason: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  expected_saving: number;
  estimated_cost_now: number;
  estimated_cost_later: number;
  alternative_scenarios: Record<string, BackendOptionResult>;
  best_procurement_option: string;
  savings_vs_charter_now: number;
  assumptions: Record<string, unknown>;
}

export interface BackendRecommendationHistoryItem {
  id: number;
  origin: string;
  destination: string;
  cargo_quantity: number;
  vessel_size: string;
  current_rate: number;
  predicted_rate: number;
  recommendation: string;
  reason: string;
  risk_level: string;
  confidence: number;
  expected_saving: number;
  created_at: string;
}

export interface BackendScenarioHistoryItem {
  id: number;
  origin: string;
  destination: string;
  cargo_quantity: number;
  vessel_size: string;
  current_rate: number;
  fuel_price: number;
  predicted_rate: number;
  recommendation: string;
  estimated_savings: number;
  created_at: string;
  confidence?: number | null;
  risk_level?: string | null;
}

export interface BackendModelRun {
  id: number;
  model_name: string;
  horizon_days: number;
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
  training_rows: number;
  is_best_model: boolean;
  training_start: string;
  training_end: string;
  created_at: string;
}

// --- Maritime (ports / vessels / feasibility / congestion / voyage) ---

export interface BackendPort {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  max_draft: number;
  max_loa: number;
  max_beam: number;
  berth_capacity: number;
  cargo_types_supported: string[];
  cargo_handling_rate: number;
  max_vessel_size: number;
  congestion_index: number;
  berth_utilization: number;
  turnaround_time: number;
  anchorage_wait_time: number;
  operating_status?: string;
  restrictions?: string[];
  data_source?: string;
  data_timestamp?: string;
}

export interface BackendVessel {
  id: string;
  vessel_type: string;
  dwt: number;
  cargo_capacity: number;
  loa: number;
  beam: number;
  draft: number;
  laden_speed: number;
  ballast_speed: number;
  daily_opex: number;
  daily_charter_rate: number;
  loading_rate: number;
  discharge_rate: number;
  cargo_types: string[];
  data_source?: string;
  data_timestamp?: string;
}

export interface BackendOrigin {
  id: string;
  region: string;
  load_port: string;
  latitude: number;
  longitude: number;
  detour_factor: number;
  typical_cargo: string[];
  data_source?: string;
  data_timestamp?: string;
}

export interface BackendFeasibilityResult {
  status: "FEASIBLE" | "FEASIBLE_WITH_WARNINGS" | "NOT_FEASIBLE";
  port: { id: string; name: string };
  vessel: { id: string; vessel_type: string };
  cargo_type: string | null;
  cargo_quantity: number | null;
  checks: Record<string, boolean>;
  reasons: string[];
  warnings: string[];
  handling: {
    effective_loading_rate_tpd: number;
    effective_discharge_rate_tpd: number;
    estimated_discharge_days: number | null;
    estimated_loading_days: number | null;
  };
  restrictions: string[];
  data_source?: string;
  data_timestamp?: string;
}

export interface BackendCongestionResult {
  port_id: string;
  port_name: string;
  congestion_index: number;
  congestion_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  berth_utilization: number;
  queue_factor: number;
  waiting_time_days: number;
  uncongested_wait_days: number;
  congestion_delay_days: number;
  additional_idle_days: number;
  daily_cost_basis_usd: number;
  congestion_cost_usd: number;
  reference_index_uncongested: number;
  data_source?: string;
  data_timestamp?: string;
  assumptions?: string;
}

export interface BackendVoyageResult {
  origin: { id: string; region: string; load_port: string };
  destination_port: { id: string; name: string; state: string };
  vessel: { id: string; vessel_type: string; dwt: number };
  cargo_type: string | null;
  cargo_quantity: number;
  feasibility: BackendFeasibilityResult;
  distance: { distance_nm: number; [key: string]: unknown };
  duration_days: {
    sailing_laden: number;
    ballast: number;
    loading: number;
    discharge: number;
    port_waiting: number;
    congestion_delay: number;
    port_turn_overhead: number;
    total_voyage_duration: number;
  };
  congestion: BackendCongestionResult;
  assumptions: Record<string, unknown>;
}

export interface IntegratedDecisionResult {
  input_adjusted?: boolean;
  original_input?: {
    origin_id: string;
    port_id: string;
    cargo_quantity: number;
    cargo_type?: string | null;
    current_freight_rate: number;
    fuel_price: number;
    vessel_preference?: string | null;
  };
  evaluated_input?: {
    origin_id: string;
    port_id: string;
    cargo_quantity: number;
    cargo_type?: string | null;
    vessel_preference?: string | null;
  };
  recommendation: {
    contract: string;
    voyages: number;
    vessel_type: string;
    port: string;
    reason: string;
  };
  contract_options: Array<{
    voyages: number;
    contract: string;
    label: string;
    effective_rate: number;
    forecast_rate: number;
    confidence: number;
    lower_bound: number;
    upper_bound: number;
    freight_cost: number;
    fuel_cost: number;
    congestion_idle_cost: number;
    uncertainty_cost: number;
    commitment_cost: number;
    total_cost: number;
    cost_per_ton: number;
    discount_pct: number;
    savings_vs_spot: number;
  }>;
  vessel_ranking: Array<{
    vessel_id: string;
    vessel_type: string;
    score: number;
    cargo_capacity: number;
    draft: number;
    loa: number;
    beam: number;
    daily_charter_rate: number;
    feasibility: BackendFeasibilityResult;
  }>;
  selected_vessel: BackendVessel;
  voyage: BackendVoyageResult;
  idle_management: {
    trigger: string;
    current_idle_days: number;
    recommended_strategy: string;
    alternatives: Array<{
      port_id: string;
      port_name: string;
      congestion_level: string;
      congestion_index: number;
      reposition_days: number;
      reposition_cost_usd: number;
      idle_days_avoided: number;
      feasibility: string;
      strategy: string;
    }>;
    deadheading_note: string;
  };
  risk_alerts: Array<{ level: string; type: string; message: string }>;
  data_provenance: {
    market_history: string;
    port_master: string;
    route_distance: string;
    live_port_feed: boolean;
  };
}

export interface MarketSignals {
  freight_rate?: number;
  fuel_price?: number;
  demand_index?: number;
  supply_index?: number;
  port_congestion_index?: number;
  demand_supply_pressure?: number;
  observations: number;
  data_classification: string;
}
