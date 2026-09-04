// Vessel reference-data domain with an automatic bundled-data fallback.
import { request, ApiClientError } from "./client";
import { DEMO_VESSELS } from "../demo-maritime";
import type { BackendVessel } from "../types";

const unavailable = (e: unknown) => e instanceof ApiClientError && ["offline", "unknown", "server", "no-data"].includes(e.kind);

export async function listVessels(): Promise<BackendVessel[]> {
  try {
    const b = await request<{ vessels: BackendVessel[] }>("/api/maritime/vessels");
    return b.vessels;
  } catch (e) {
    if (unavailable(e)) return DEMO_VESSELS;
    throw e;
  }
}

export async function getVessel(vesselId: string): Promise<BackendVessel> {
  return request<BackendVessel>(`/api/maritime/vessels/${encodeURIComponent(vesselId)}`);
}
