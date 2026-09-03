// Procurement optimizer domain: POST /api/optimize.

import { request } from "./client";
import { rankOptions, labelForKey } from "./_procurementOptions";
import type { BackendOptimizeResult, OptimizeResult } from "../types";

export async function getOptimize(body: {
  origin: string;
  destination: string;
  vessel: string;
}): Promise<OptimizeResult> {
  const backendBody = {
    origin: body.origin,
    destination: body.destination,
    vessel_type: body.vessel,
    // The optimizer needs a cargo quantity / current rate / fuel price to
    // cost each option; the route-only pages (Command Center, Charter
    // Decision, Optimization) use representative defaults consistent with
    // the What-If simulator's own defaults so the numbers are directly
    // comparable across pages.
    cargo_quantity: 50000,
    current_freight_rate: 65.96,
    fuel_price: 620,
  };
  const b = await request<BackendOptimizeResult>("/api/optimize", {
    method: "POST",
    body: JSON.stringify(backendBody),
  });
  return {
    options: rankOptions(b.options),
    recommended: labelForKey(b.best_option),
    origin: b.origin,
    destination: b.destination,
    vessel: b.vessel_type,
  };
}
