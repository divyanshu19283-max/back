// Market data domain: available routes/vessels, dataset summary, and EDA stats.
// Route discovery falls back to the same bundled demo combinations used by the UI.

import { request, ApiClientError } from "./client";
import { DEMO_ROUTES } from "../demo-maritime";
import type { BackendRoutesResponse, BackendSummary, BackendEda, RoutesResponse, DataSummary, EDAStats } from "../types";

const unavailable = (e: unknown) => e instanceof ApiClientError && ["offline", "unknown", "server", "no-data"].includes(e.kind);

export async function getRoutes(): Promise<RoutesResponse & { _demo?: boolean }> {
  try {
    const b = await request<BackendRoutesResponse>("/api/data/routes");
    const byOrigin = new Map<string, Set<string>>();
    const vesselTypes = new Set<string>();
    for (const row of b.routes) {
      if (!byOrigin.has(row.origin)) byOrigin.set(row.origin, new Set());
      byOrigin.get(row.origin)!.add(row.destination);
      vesselTypes.add(row.vessel_type);
    }
    return {
      routes: Array.from(byOrigin.entries()).map(([origin, destinations]) => ({ origin, destinations: Array.from(destinations) })),
      vessel_types: Array.from(vesselTypes),
      combinations: b.routes,
    };
  } catch (e) {
    if (unavailable(e)) return { ...DEMO_ROUTES, _demo: true };
    throw e;
  }
}

export async function getSummary(): Promise<DataSummary> {
  const b = await request<BackendSummary>("/api/data/summary");
  return { dataset_size: b.row_count, routes: b.route_count ?? 0, date_range: b.date_range, avg_freight_rate: b.avg_freight_rate ?? 0, min_freight_rate: b.min_freight_rate ?? 0, max_freight_rate: b.max_freight_rate ?? 0, vessel_types: b.vessel_types, origins: b.origins };
}

export async function getEda(): Promise<EDAStats> {
  const b = await request<BackendEda>("/api/data/eda");
  return { rate_distribution: b.rate_distribution ?? [], route_distribution: b.route_distribution ?? [], historical_trend: b.historical_trend ?? [], vessel_distribution: b.vessel_distribution ?? [], summary: b.overall ?? {} };
}
