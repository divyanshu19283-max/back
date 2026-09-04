// Port reference-data domain with an automatic bundled-data fallback.
import { request, ApiClientError } from "./client";
import { DEMO_PORTS } from "../demo-maritime";
import type { BackendPort } from "../types";

const unavailable = (e: unknown) => e instanceof ApiClientError && ["offline", "unknown", "server", "no-data"].includes(e.kind);

export async function listPorts(): Promise<BackendPort[]> {
  try {
    const b = await request<{ ports: BackendPort[] }>("/api/maritime/ports");
    return b.ports;
  } catch (e) {
    if (unavailable(e)) return DEMO_PORTS;
    throw e;
  }
}

export async function getPort(portId: string): Promise<BackendPort> {
  return request<BackendPort>(`/api/maritime/ports/${encodeURIComponent(portId)}`);
}
