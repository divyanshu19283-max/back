// Vessel reference-data domain: GET /api/maritime/vessels[/{id}].
// Backed by app/services/reference_data.py + app/data/vessels.py — real
// class-representative dry-bulk vessel figures (DWT, draft, speed, opex,
// charter rate) used by the feasibility and voyage-economics engines.

import { request } from "./client";
import type { BackendVessel } from "../types";

export async function listVessels(): Promise<BackendVessel[]> {
  const b = await request<{ vessels: BackendVessel[] }>("/api/maritime/vessels");
  return b.vessels;
}

export async function getVessel(vesselId: string): Promise<BackendVessel> {
  return request<BackendVessel>(`/api/maritime/vessels/${encodeURIComponent(vesselId)}`);
}
