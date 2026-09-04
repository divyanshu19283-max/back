// Barrel for the whole API layer. Components/hooks import from '@/lib/api'.
import { request, BASE, ApiClientError, probeBackend } from "./client";
import { getForecast, getForecastHistory } from "./forecast";
import { getRoutes, getSummary, getEda } from "./market";
import { postWhatIf, getScenariosHistory } from "./whatif";
import { getOptimize } from "./optimization";
import { getRecommendationsHistory } from "./charter";
import { getModelRuns } from "./models";
import { listPorts } from "./ports";
import { listVessels } from "./vessels";
import { DEMO_ORIGINS } from "../demo-maritime";
import type { HealthResponse } from "../types";

const unavailable = (e: unknown) => e instanceof ApiClientError && ["offline", "unknown", "server", "no-data"].includes(e.kind);

export { ApiClientError, probeBackend };
export * from "./ports";
export * from "./vessels";
export * from "./feasibility";
export * from "./congestion";
export * from "./voyage";
export * from "./integrated";

export const apiOrigins = async () => {
  try {
    return (await request<{ origins: import("../types").BackendOrigin[] }>("/api/maritime/origins")).origins;
  } catch (e) {
    if (unavailable(e)) return DEMO_ORIGINS;
    throw e;
  }
};

export const api = {
  base: BASE,
  health: () => request<HealthResponse>("/health"),
  routes: getRoutes,
  summary: getSummary,
  eda: getEda,
  forecast: getForecast,
  forecastHistory: getForecastHistory,
  whatif: postWhatIf,
  optimize: getOptimize,
  recommendationsHistory: getRecommendationsHistory,
  scenariosHistory: getScenariosHistory,
  modelRuns: getModelRuns,
  origins: apiOrigins,
  listPorts,
  listVessels,
};
