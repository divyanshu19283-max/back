// Barrel for the whole API layer. Components/hooks import from '@/lib/api'
// and never reach into individual files or call fetch() directly.
//
//   src/lib/api/
//   ├── client.ts        shared fetch wrapper: base URL, JSON, timeout, errors
//   ├── forecast.ts       POST /api/forecast, GET /api/forecast/history
//   ├── market.ts         GET /api/data/{routes,summary,eda}
//   ├── whatif.ts          POST /api/whatif, GET /api/scenarios/history
//   ├── optimization.ts   POST /api/optimize
//   ├── charter.ts         GET /api/recommendations/history
//   ├── models.ts          GET /api/model-runs
//   ├── ports.ts           GET /api/maritime/ports[/:id]
//   ├── vessels.ts         GET /api/maritime/vessels[/:id]
//   ├── feasibility.ts     POST /api/maritime/feasibility
//   ├── congestion.ts      POST /api/maritime/congestion
//   └── voyage.ts          POST /api/maritime/voyage

import { request, BASE, ApiClientError, probeBackend } from "./client";
import { getForecast, getForecastHistory } from "./forecast";
import { getRoutes, getSummary, getEda } from "./market";
import { postWhatIf, getScenariosHistory } from "./whatif";
import { getOptimize } from "./optimization";
import { getRecommendationsHistory } from "./charter";
import { getModelRuns } from "./models";
import { listPorts } from "./ports";
import { listVessels } from "./vessels";
import type { HealthResponse } from "../types";

export { ApiClientError, probeBackend };
export * from "./ports";
export * from "./vessels";
export * from "./feasibility";
export * from "./congestion";
export * from "./voyage";
export * from "./integrated";
export const apiOrigins = async () =>
  request<{ origins: import("../types").BackendOrigin[] }>("/api/maritime/origins");

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
  origins: async () => (await apiOrigins()).origins,
  listPorts,
  listVessels,
};
