import type {
  BackendOrigin,
  BackendPort,
  BackendVessel,
  IntegratedDecisionResult,
  MarketSignals,
  RoutesResponse,
} from "./types";

const DEMO_TS = "2026-01-01T00:00:00Z";

export const DEMO_ROUTES: RoutesResponse = {
  routes: [
    { origin: "Australia", destinations: ["East Coast India"] },
    { origin: "Brazil", destinations: ["East Coast India"] },
    { origin: "Indonesia", destinations: ["East Coast India"] },
    { origin: "South Africa", destinations: ["East Coast India"] },
    { origin: "USA Gulf", destinations: ["East Coast India"] },
  ],
  vessel_types: ["Bulk Carrier", "Capesize", "Panamax", "Supramax"],
  combinations: ["Australia", "Brazil", "Indonesia", "South Africa", "USA Gulf"].flatMap((origin) =>
    ["Bulk Carrier", "Capesize", "Panamax", "Supramax"].map((vessel_type) => ({
      origin, destination: "East Coast India", vessel_type, rows: 2062,
    })),
  ),
};

export const DEMO_VESSELS: BackendVessel[] = [
  { id: "handysize", vessel_type: "Handysize", dwt: 32000, loa: 180, beam: 28, draft: 10, cargo_capacity: 30000, laden_speed: 12.5, ballast_speed: 13.5, daily_opex: 5200, daily_charter_rate: 11000, loading_rate: 9000, discharge_rate: 8000, cargo_types: ["Coal", "Grain", "Fertilizer", "Bauxite", "Limestone"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "supramax", vessel_type: "Supramax", dwt: 58000, loa: 190, beam: 32.3, draft: 12.8, cargo_capacity: 55000, laden_speed: 13.5, ballast_speed: 14.5, daily_opex: 6000, daily_charter_rate: 15500, loading_rate: 16000, discharge_rate: 14000, cargo_types: ["Coal", "Iron Ore", "Grain", "Fertilizer", "Bauxite", "Limestone"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "panamax", vessel_type: "Panamax", dwt: 76000, loa: 229, beam: 32.3, draft: 14.2, cargo_capacity: 72000, laden_speed: 13.5, ballast_speed: 14.5, daily_opex: 6600, daily_charter_rate: 18500, loading_rate: 24000, discharge_rate: 20000, cargo_types: ["Coal", "Iron Ore", "Grain", "Bauxite", "Limestone"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "capesize", vessel_type: "Capesize", dwt: 180000, loa: 292, beam: 45, draft: 18.2, cargo_capacity: 172000, laden_speed: 14, ballast_speed: 15, daily_opex: 8200, daily_charter_rate: 27000, loading_rate: 45000, discharge_rate: 38000, cargo_types: ["Coal", "Iron Ore", "Bauxite", "Limestone"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
];

export const DEMO_ORIGINS: BackendOrigin[] = [
  { id: "australia", region: "Australia", load_port: "Hay Point / Newcastle (representative)", latitude: -21.28, longitude: 149.3, detour_factor: 1.08, typical_cargo: ["Coal", "Iron Ore", "Bauxite"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "indonesia", region: "Indonesia", load_port: "Samarinda / Taboneo (representative)", latitude: -3.6, longitude: 114.55, detour_factor: 1.12, typical_cargo: ["Coal"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "south_africa", region: "South Africa", load_port: "Richards Bay (representative)", latitude: -28.8, longitude: 32.05, detour_factor: 1.06, typical_cargo: ["Coal", "Iron Ore"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "brazil", region: "Brazil", load_port: "Tubarao / Ponta da Madeira (representative)", latitude: -20.28, longitude: -40.25, detour_factor: 1.15, typical_cargo: ["Iron Ore", "Grain", "Bauxite"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
  { id: "usa_gulf", region: "USA Gulf", load_port: "New Orleans / Mississippi River (representative)", latitude: 29.2, longitude: -89.4, detour_factor: 1.22, typical_cargo: ["Grain", "Coal", "Fertilizer"], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS },
];

const port = (id: string, name: string, state: string, draft: number, loa: number, beam: number, capacity: number, congestion: number, berth: number, wait: number, cargo: string[], handling: number, maxSize: number): BackendPort => ({ id, name, state, latitude: 0, longitude: 0, max_draft: draft, max_loa: loa, max_beam: beam, berth_capacity: capacity, cargo_types_supported: cargo, cargo_handling_rate: handling, max_vessel_size: maxSize, congestion_index: congestion, berth_utilization: berth, turnaround_time: 3, anchorage_wait_time: wait, operating_status: "OPERATIONAL", data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS });

export const DEMO_PORTS: BackendPort[] = [
  port("paradip", "Paradip", "Odisha", 18, 300, 50, 8, 58, .78, 1.8, ["Coal", "Iron Ore", "Limestone", "Fertilizer", "Bauxite"], 32000, 180000),
  port("visakhapatnam", "Visakhapatnam", "Andhra Pradesh", 17, 290, 48, 7, 64, .83, 2.4, ["Coal", "Iron Ore", "Limestone", "Fertilizer", "Grain"], 28000, 165000),
  port("gangavaram", "Gangavaram", "Andhra Pradesh", 21, 320, 55, 6, 34, .62, .9, ["Coal", "Iron Ore", "Limestone", "Bauxite", "Fertilizer"], 40000, 200000),
  port("gopalpur", "Gopalpur", "Odisha", 13, 230, 38, 3, 26, .48, .6, ["Coal", "Limestone", "Bauxite", "Fertilizer"], 14000, 82000),
  port("dhamra", "Dhamra", "Odisha", 18.5, 300, 50, 4, 41, .66, 1.1, ["Coal", "Iron Ore", "Limestone", "Fertilizer"], 36000, 185000),
];

export function buildDemoMarketSignals(origin?: string): MarketSignals & { _demo?: boolean } {
  const freight = origin?.toLowerCase().includes("indonesia") ? 62.4 : origin?.toLowerCase().includes("brazil") ? 68.1 : 65.96;
  return { freight_rate: freight, fuel_price: 620, demand_index: 71, supply_index: 63, port_congestion_index: 52, demand_supply_pressure: 8, observations: 2062, data_classification: "DEMO_ASSUMED — bundled local fallback", _demo: true };
}

export function buildDemoIntegratedDecision(input: {
  originId: string; portId: string; cargoQuantity: number; cargoType: string; currentFreightRate: number; fuelPrice: number; vesselPreference?: string;
}): IntegratedDecisionResult & { _demo?: boolean } {
  const vessel = DEMO_VESSELS.find((v) => v.vessel_type === input.vesselPreference) ?? DEMO_VESSELS[2];
  const selectedPort = DEMO_PORTS.find((p) => p.id === input.portId) ?? DEMO_PORTS[0];
  const feasible = input.cargoQuantity <= vessel.cargo_capacity && vessel.draft <= selectedPort.max_draft && vessel.loa <= selectedPort.max_loa && vessel.beam <= selectedPort.max_beam && selectedPort.cargo_types_supported.includes(input.cargoType);
  const forecastRate = +(input.currentFreightRate * 1.018).toFixed(2);
  const freightCost = +(forecastRate * input.cargoQuantity).toFixed(2);
  const fuelCost = +(input.fuelPrice * vessel.dwt * 0.0022).toFixed(2);
  const idleCost = +(selectedPort.congestion_index * 42 * vessel.daily_charter_rate / 100).toFixed(2);
  const total = freightCost + fuelCost + idleCost;
  const feasibility = {
    status: feasible ? "FEASIBLE" : "NOT_FEASIBLE",
    port: { id: selectedPort.id, name: selectedPort.name }, vessel: { id: vessel.id, vessel_type: vessel.vessel_type }, cargo_type: input.cargoType, cargo_quantity: input.cargoQuantity,
    checks: { capacity: input.cargoQuantity <= vessel.cargo_capacity, draft: vessel.draft <= selectedPort.max_draft, loa: vessel.loa <= selectedPort.max_loa, beam: vessel.beam <= selectedPort.max_beam, cargo: selectedPort.cargo_types_supported.includes(input.cargoType) },
    reasons: feasible ? [] : ["Selected vessel or cargo is outside the demo port constraints."], warnings: ["Backend unavailable; using bundled demo reference data."],
    handling: { effective_loading_rate_tpd: Math.min(vessel.loading_rate, selectedPort.cargo_handling_rate), effective_discharge_rate_tpd: Math.min(vessel.discharge_rate, selectedPort.cargo_handling_rate), estimated_discharge_days: +(input.cargoQuantity / Math.min(vessel.discharge_rate, selectedPort.cargo_handling_rate)).toFixed(1), estimated_loading_days: +(input.cargoQuantity / Math.min(vessel.loading_rate, selectedPort.cargo_handling_rate)).toFixed(1) }, restrictions: [], data_source: "DEMO_ASSUMED", data_timestamp: DEMO_TS,
  } as import("./types").BackendFeasibilityResult;
  const voyage = {} as import("./types").BackendVoyageResult;
  return {
    input_adjusted: false,
    evaluated_input: { origin_id: input.originId, port_id: input.portId, cargo_quantity: input.cargoQuantity, cargo_type: input.cargoType, vessel_preference: input.vesselPreference },
    recommendation: { contract: "TIME_CHARTER", voyages: 3, vessel_type: vessel.vessel_type, port: selectedPort.name, reason: "Demo risk-adjusted economics favor a short committed charter." },
    contract_options: [1, 3, 6].map((months, i) => ({ voyages: months, contract: "TIME_CHARTER", label: `${months} voyage${months > 1 ? "s" : ""}`, effective_rate: +(input.currentFreightRate * (1 - i * .018)).toFixed(2), forecast_rate: forecastRate, confidence: 86 - i * 2, lower_bound: +(forecastRate * .94).toFixed(2), upper_bound: +(forecastRate * 1.06).toFixed(2), freight_cost: freightCost * (1 - i * .015), fuel_cost: fuelCost, congestion_idle_cost: idleCost, uncertainty_cost: total * .018, commitment_cost: total * (i * .008), total_cost: total * (1 - i * .01), cost_per_ton: (total * (1 - i * .01)) / input.cargoQuantity, discount_pct: i * 1.8, savings_vs_spot: total * i * .01 })),
    vessel_ranking: DEMO_VESSELS.map((v, i) => ({ vessel_id: v.id, vessel_type: v.vessel_type, score: 94 - i * 6, cargo_capacity: v.cargo_capacity, draft: v.draft, loa: v.loa, beam: v.beam, daily_charter_rate: v.daily_charter_rate, feasibility })),
    selected_vessel: vessel,
    voyage,
    idle_management: { trigger: "CONGESTION_MONITOR", current_idle_days: selectedPort.anchorage_wait_time, recommended_strategy: "Monitor congestion and preserve an alternate discharge option.", alternatives: DEMO_PORTS.slice(0, 3).map((p) => ({ port_id: p.id, port_name: p.name, congestion_level: p.congestion_index > 70 ? "HIGH" : p.congestion_index > 50 ? "MODERATE" : "LOW", congestion_index: p.congestion_index, reposition_days: 1.2, reposition_cost_usd: 18000, idle_days_avoided: Math.max(0, selectedPort.anchorage_wait_time - p.anchorage_wait_time), feasibility: "FEASIBLE", strategy: "Use as alternate discharge." })), deadheading_note: "Bundled demo estimate." },
    risk_alerts: [{ level: "INFO", type: "DATA_MODE", message: "Backend unavailable; decision is running on bundled demo data." }],
    data_provenance: { market_history: "Bundled demo history", port_master: "Bundled demo port master", route_distance: "Bundled demo route assumptions", live_port_feed: false },
    _demo: true,
  };
}
