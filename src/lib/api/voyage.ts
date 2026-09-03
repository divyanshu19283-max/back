// Voyage analysis domain: POST /api/maritime/voyage.
// Backed by app/services/routing.py — combines distance, sailing/loading/
// discharge duration, feasibility, and congestion into a full voyage
// time-and-cost budget (origin -> port -> vessel).

import { request } from "./client";
import type { BackendVoyageResult } from "../types";

export async function analyzeVoyage(input: {
  originId: string;
  portId: string;
  vesselId: string;
  cargoQuantity: number;
  cargoType?: string;
  includeBallast?: boolean;
  demurrageRatePerDay?: number;
  strict?: boolean;
}): Promise<BackendVoyageResult> {
  return request<BackendVoyageResult>("/api/maritime/voyage", {
    method: "POST",
    body: JSON.stringify({
      origin_id: input.originId,
      port_id: input.portId,
      vessel_id: input.vesselId,
      cargo_quantity: input.cargoQuantity,
      cargo_type: input.cargoType,
      include_ballast: input.includeBallast ?? true,
      demurrage_rate_per_day: input.demurrageRatePerDay ?? 0,
      strict: input.strict ?? true,
    }),
  });
}
