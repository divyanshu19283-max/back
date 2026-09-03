// Feasibility domain: POST /api/maritime/feasibility, GET /api/maritime/feasibility/{port_id}.
// Backed by app/services/feasibility.py — the six-check draft/LOA/beam/
// cargo/capacity/handling engine described in the problem statement.

import { request } from "./client";
import type { BackendFeasibilityResult } from "../types";

export async function checkFeasibility(input: {
  portId: string;
  vesselId: string;
  cargoType?: string;
  cargoQuantity?: number;
}): Promise<BackendFeasibilityResult> {
  return request<BackendFeasibilityResult>("/api/maritime/feasibility", {
    method: "POST",
    body: JSON.stringify({
      port_id: input.portId,
      vessel_id: input.vesselId,
      cargo_type: input.cargoType,
      cargo_quantity: input.cargoQuantity,
    }),
  });
}

export async function feasibleVesselsForPort(
  portId: string,
  opts?: { cargoType?: string; cargoQuantity?: number },
): Promise<{ port_id: string; results: BackendFeasibilityResult[] }> {
  const params = new URLSearchParams();
  if (opts?.cargoType) params.set("cargo_type", opts.cargoType);
  if (opts?.cargoQuantity) params.set("cargo_quantity", String(opts.cargoQuantity));
  const qs = params.toString();
  return request(`/api/maritime/feasibility/${encodeURIComponent(portId)}${qs ? `?${qs}` : ""}`);
}
