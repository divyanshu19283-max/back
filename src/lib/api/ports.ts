// Port reference-data domain: GET /api/maritime/ports[/{id}].
// Backed by app/services/reference_data.py + app/data/ports.py — real East
// Coast India discharge-port master data (draft/LOA/beam limits, handling
// rates, congestion index), seeded into the DB on backend startup.
// No frontend page consumes this yet; exposed here so a future Ports view
// (or the voyage/feasibility flows) can call it through the same layer.

import { request } from "./client";
import type { BackendPort } from "../types";

export async function listPorts(): Promise<BackendPort[]> {
  const b = await request<{ ports: BackendPort[] }>("/api/maritime/ports");
  return b.ports;
}

export async function getPort(portId: string): Promise<BackendPort> {
  return request<BackendPort>(`/api/maritime/ports/${encodeURIComponent(portId)}`);
}
