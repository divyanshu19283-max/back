// What-if simulator domain: POST /api/whatif and GET /api/scenarios/history.

import { request } from "./client";
import { rankOptions, labelForKey } from "./_procurementOptions";
import type {
  BackendWhatIfResult,
  BackendScenarioHistoryItem,
  WhatIfInput,
  WhatIfResult,
  ScenarioHistoryItem,
} from "../types";

// Routes are built and displayed as "Origin \u2192 Destination" (see the
// select options in WhatIf.tsx), but be defensive about what actually shows
// up here: accept a plain ASCII "->" too, and tolerate extra whitespace
// around the separator, so a manually-edited or copy-pasted route string
// still parses instead of silently falling through to the defaults below.
function parseRoute(route: string | undefined): [string, string] {
  const raw = (route ?? "").trim();
  const parts = raw
    .split(/\s*(?:\u2192|->)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
}

export async function postWhatIf(input: WhatIfInput): Promise<WhatIfResult> {
  const [origin, destination] = parseRoute(input.route);
  const backendBody = {
    origin: origin || "Australia",
    destination: destination || "East Coast India",
    vessel_type: input.vessel ?? "Panamax",
    cargo_quantity: input.cargo_quantity,
    current_freight_rate: input.current_freight_rate,
    fuel_price: input.fuel_price,
    horizon_days: input.horizon ?? 30,
    save_scenario: true,
  };
  const b = await request<BackendWhatIfResult>("/api/whatif", {
    method: "POST",
    body: JSON.stringify(backendBody),
  });
  const options = rankOptions(b.alternative_scenarios).map((o) => ({
    label: o.label,
    freight_cost: o.freight_cost,
    fuel_cost: o.fuel_cost,
    risk_adjustment: o.risk_adjustment,
    total: o.total_cost,
    savings: o.savings,
  }));
  return {
    options,
    recommended: labelForKey(b.best_procurement_option),
    cargo_quantity: b.scenario_input.cargo_quantity,
    fuel_price: b.scenario_input.fuel_price,
    horizon: b.scenario_input.horizon_days,
  };
}

export async function getScenariosHistory(): Promise<ScenarioHistoryItem[]> {
  const rows = await request<BackendScenarioHistoryItem[]>("/api/scenarios/history");
  return rows.map((r) => ({
    id: r.id,
    date: r.created_at,
    route: `${r.origin} \u2192 ${r.destination}`,
    vessel: r.vessel_size,
    action: r.recommendation,
    confidence: (r.confidence ?? 0) * 100,
    risk: r.risk_level ?? "MEDIUM",
    savings: r.estimated_savings,
  }));
}
