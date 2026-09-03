// Congestion domain: POST /api/maritime/congestion.
// Backed by app/services/congestion.py — congestion-index banding, the
// queueing-derived waiting-time model, and cost impact.

import { request } from "./client";
import type { BackendCongestionResult } from "../types";

export async function assessCongestion(input: {
  portId: string;
  vesselId?: string;
  demurrageRatePerDay?: number;
}): Promise<BackendCongestionResult> {
  return request<BackendCongestionResult>("/api/maritime/congestion", {
    method: "POST",
    body: JSON.stringify({
      port_id: input.portId,
      vessel_id: input.vesselId,
      demurrage_rate_per_day: input.demurrageRatePerDay ?? 0,
    }),
  });
}
