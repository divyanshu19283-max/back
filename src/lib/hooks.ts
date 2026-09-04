// TanStack Query hooks with built-in demo fallback.
// Live backend is always preferred; transient backend/CORS/5xx failures fall back
// to bundled data so the dashboard never becomes unusable.

import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { api, ApiClientError } from "./api";
import {
  DEMO_SUMMARY,
  DEMO_EDA,
  buildDemoForecast,
  buildDemoWhatIf,
  DEMO_OPTIMIZE,
  DEMO_RECOMMENDATIONS,
  DEMO_SCENARIOS,
  DEMO_MODEL_RUNS,
  DEMO_FORECAST_HISTORY,
} from "./demo";
import {
  DEMO_ROUTES,
  DEMO_VESSELS,
  DEMO_ORIGINS,
  DEMO_PORTS,
  buildDemoMarketSignals,
  buildDemoIntegratedDecision,
} from "./demo-maritime";
import { getIntegratedDecision, getMarketSignals } from "./api";
import type {
  RoutesResponse,
  DataSummary,
  EDAStats,
  ForecastResult,
  WhatIfInput,
  WhatIfResult,
  OptimizeResult,
  RecommendationHistoryItem,
  ScenarioHistoryItem,
  ModelRun,
  ForecastHistoryItem,
  IntegratedDecisionResult,
} from "./types";

const isOffline = (e: unknown) =>
  e instanceof ApiClientError &&
  ["offline", "unknown", "server", "no-data"].includes(e.kind);

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    refetchInterval: 30000,
    retry: 0,
    staleTime: 15000,
  });
}

export function useRoutes() {
  return useQuery<RoutesResponse & { _demo?: boolean }>({
    queryKey: ["routes"],
    queryFn: async () => {
      try {
        return await api.routes();
      } catch (e) {
        if (isOffline(e)) return { ...DEMO_ROUTES, _demo: true };
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
    refetchOnWindowFocus: true,
  });
}

export function useSummary() {
  return useQuery<DataSummary & { _demo?: boolean }>({
    queryKey: ["summary"],
    queryFn: async () => {
      try { return await api.summary(); }
      catch (e) { if (isOffline(e)) return { ...DEMO_SUMMARY, _demo: true }; throw e; }
    },
    staleTime: 60 * 1000,
    retry: 0,
  });
}

export function useEda() {
  return useQuery<EDAStats & { _demo?: boolean }>({
    queryKey: ["eda"],
    queryFn: async () => {
      try { return await api.eda(); }
      catch (e) { if (isOffline(e)) return { ...DEMO_EDA, _demo: true }; throw e; }
    },
    staleTime: 60 * 1000,
    retry: 0,
  });
}

function isCompleteForecastSelection(
  body: { origin: string; destination: string; vessel: string; horizon: number } | null,
): body is { origin: string; destination: string; vessel: string; horizon: number } {
  return !!body && !!body.origin?.trim() && !!body.destination?.trim() && !!body.vessel?.trim() && Number.isFinite(body.horizon) && body.horizon > 0;
}

export function useForecast(body: { origin: string; destination: string; vessel: string; horizon: number } | null) {
  const valid = isCompleteForecastSelection(body);
  const routesQ = useRoutes();
  const supported = !!body && !!routesQ.data?.combinations?.some((r) =>
    r.origin.trim().toLowerCase() === body.origin.trim().toLowerCase() &&
    r.destination.trim().toLowerCase() === body.destination.trim().toLowerCase() &&
    r.vessel_type.trim().toLowerCase() === body.vessel.trim().toLowerCase(),
  );
  const routeReady = !!routesQ.data && supported;
  return useQuery<ForecastResult & { _demo?: boolean }>({
    queryKey: ["forecast", body],
    queryFn: async () => {
      if (!valid) throw new Error("No input");
      try { return await api.forecast(body); }
      catch (e) {
        if (isOffline(e)) return { ...buildDemoForecast(body.origin, body.destination, body.vessel, body.horizon), _demo: true };
        throw e;
      }
    },
    enabled: valid && routeReady,
    placeholderData: keepPreviousData,
    retry: 0,
  });
}

export function useForecastHistory() {
  return useQuery<ForecastHistoryItem[]>({
    queryKey: ["forecast-history"],
    queryFn: async () => {
      try { return await api.forecastHistory(); }
      catch (e) { if (isOffline(e)) return DEMO_FORECAST_HISTORY; throw e; }
    },
    retry: 0,
  });
}

export function useWhatIf() {
  return useMutation<WhatIfResult & { _demo?: boolean }, ApiClientError, WhatIfInput>({
    mutationFn: async (input) => {
      try { return await api.whatif(input); }
      catch (e) { if (isOffline(e)) return { ...buildDemoWhatIf(input), _demo: true }; throw e; }
    },
    retry: 0,
  });
}

export function useOptimize(body: { origin: string; destination: string; vessel: string } | null) {
  const valid = !!body && !!body.origin?.trim() && !!body.destination?.trim() && !!body.vessel?.trim();
  const routesQ = useRoutes();
  const supported = !!body && !!routesQ.data?.combinations?.some((r) =>
    r.origin.trim().toLowerCase() === body.origin.trim().toLowerCase() &&
    r.destination.trim().toLowerCase() === body.destination.trim().toLowerCase() &&
    r.vessel_type.trim().toLowerCase() === body.vessel.trim().toLowerCase(),
  );
  const routeReady = !!routesQ.data && supported;
  return useQuery<OptimizeResult & { _demo?: boolean }>({
    queryKey: ["optimize", body],
    queryFn: async () => {
      if (!body || !valid) throw new Error("Please choose a complete route and vessel selection.");
      try { return await api.optimize(body); }
      catch (e) { if (isOffline(e)) return { ...DEMO_OPTIMIZE, _demo: true }; throw e; }
    },
    enabled: valid && routeReady,
    placeholderData: keepPreviousData,
    retry: 0,
  });
}

export function useRecommendationsHistory() {
  return useQuery<RecommendationHistoryItem[]>({ queryKey: ["recommendations"], queryFn: async () => { try { return await api.recommendationsHistory(); } catch (e) { if (isOffline(e)) return DEMO_RECOMMENDATIONS; throw e; } }, retry: 0 });
}

export function useScenariosHistory() {
  return useQuery<ScenarioHistoryItem[]>({ queryKey: ["scenarios"], queryFn: async () => { try { return await api.scenariosHistory(); } catch (e) { if (isOffline(e)) return DEMO_SCENARIOS; throw e; } }, retry: 0 });
}

export function useModelRuns() {
  return useQuery<ModelRun[]>({ queryKey: ["model-runs"], queryFn: async () => { try { return await api.modelRuns(); } catch (e) { if (isOffline(e)) return DEMO_MODEL_RUNS; throw e; } }, retry: 0 });
}

export function useIntegratedDecision() {
  return useMutation<IntegratedDecisionResult & { _demo?: boolean }, ApiClientError, Parameters<typeof getIntegratedDecision>[0]>({
    mutationFn: async (input) => {
      try { return await getIntegratedDecision(input); }
      catch (e) { if (isOffline(e)) return buildDemoIntegratedDecision(input); throw e; }
    },
    retry: 0,
  });
}

export function useMarketSignals(origin?: string, vesselType?: string) {
  return useQuery({
    queryKey: ["market-signals", origin, vesselType],
    queryFn: async () => {
      try { return await getMarketSignals(origin, vesselType); }
      catch (e) { if (isOffline(e)) return buildDemoMarketSignals(origin); throw e; }
    },
    retry: 0,
    staleTime: 60_000,
  });
}

export function useMaritimeReferenceData() {
  const origins = useQuery({ queryKey: ["origins"], queryFn: async () => { try { return await api.origins(); } catch (e) { if (isOffline(e)) return DEMO_ORIGINS; throw e; } }, retry: 0, staleTime: 300_000 });
  const ports = useQuery({ queryKey: ["ports"], queryFn: async () => { try { return await api.listPorts(); } catch (e) { if (isOffline(e)) return DEMO_PORTS; throw e; } }, retry: 0, staleTime: 300_000 });
  const vessels = useQuery({ queryKey: ["vessels"], queryFn: async () => { try { return await api.listVessels(); } catch (e) { if (isOffline(e)) return DEMO_VESSELS; throw e; } }, retry: 0, staleTime: 300_000 });
  return { origins, ports, vessels };
}
