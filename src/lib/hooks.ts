// TanStack Query hooks with built-in demo fallback.
// When the backend is unreachable, hooks resolve to clearly-labeled demo data
// and expose `isDemo` so the UI can label it.

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
  e instanceof ApiClientError && (e.kind === "offline" || e.kind === "unknown");

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
  // Route choices must always come from the live backend. Demo routes contain
  // destinations that are not present in the bundled freight dataset (for
  // example China/Europe), and using them to drive forecast/optimization
  // requests creates avoidable 400s. Other pages may still use their own
  // demo data, but route-dependent queries must never do so.
  return useQuery<RoutesResponse>({
    queryKey: ["routes"],
    queryFn: () => api.routes(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}

export function useSummary() {
  return useQuery<DataSummary & { _demo?: boolean }>({
    queryKey: ["summary"],
    queryFn: async () => {
      try {
        return await api.summary();
      } catch (e) {
        if (isOffline(e)) return { ...DEMO_SUMMARY, _demo: true };
        throw e;
      }
    },
    staleTime: 60 * 1000,
    retry: 0,
  });
}

export function useEda() {
  return useQuery<EDAStats & { _demo?: boolean }>({
    queryKey: ["eda"],
    queryFn: async () => {
      try {
        return await api.eda();
      } catch (e) {
        if (isOffline(e)) return { ...DEMO_EDA, _demo: true };
        throw e;
      }
    },
    staleTime: 60 * 1000,
    retry: 0,
  });
}

/** True only when every field /api/forecast requires is present, non-blank,
 * and well-typed. Used to gate useForecast so an incomplete selection
 * (e.g. mid-reconciliation right after the real route list replaces a
 * demo fallback — see RouteSelector.tsx) never fires a doomed request
 * instead of surfacing as an avoidable 400. */
function isCompleteForecastSelection(
  body: { origin: string; destination: string; vessel: string; horizon: number } | null,
): body is { origin: string; destination: string; vessel: string; horizon: number } {
  return (
    !!body &&
    !!body.origin?.trim() &&
    !!body.destination?.trim() &&
    !!body.vessel?.trim() &&
    Number.isFinite(body.horizon) &&
    body.horizon > 0
  );
}

export function useForecast(
  body: { origin: string; destination: string; vessel: string; horizon: number } | null,
) {
  const valid = isCompleteForecastSelection(body);
  const routesQ = useRoutes();
  const supported =
    !!body &&
    !!routesQ.data?.combinations?.some(
      (r) =>
        r.origin.trim().toLowerCase() === body.origin.trim().toLowerCase() &&
        r.destination.trim().toLowerCase() === body.destination.trim().toLowerCase() &&
        r.vessel_type.trim().toLowerCase() === body.vessel.trim().toLowerCase(),
    );
  const routeReady = !!routesQ.data && supported;
  return useQuery<ForecastResult & { _demo?: boolean }>({
    queryKey: ["forecast", body],
    queryFn: async () => {
      if (!valid) throw new Error("No input");
      try {
        return await api.forecast(body);
      } catch (e) {
        if (isOffline(e))
          return {
            ...buildDemoForecast(body.origin, body.destination, body.vessel, body.horizon),
            _demo: true,
          };
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
      try {
        return await api.forecastHistory();
      } catch (e) {
        if (isOffline(e)) return DEMO_FORECAST_HISTORY;
        throw e;
      }
    },
    retry: 0,
  });
}

export function useWhatIf() {
  return useMutation<WhatIfResult & { _demo?: boolean }, ApiClientError, WhatIfInput>({
    mutationFn: async (input) => {
      try {
        return await api.whatif(input);
      } catch (e) {
        if (isOffline(e)) return { ...buildDemoWhatIf(input), _demo: true };
        throw e;
      }
    },
    retry: 0,
  });
}

export function useOptimize(body: { origin: string; destination: string; vessel: string } | null) {
  const valid =
    !!body && !!body.origin?.trim() && !!body.destination?.trim() && !!body.vessel?.trim();
  const routesQ = useRoutes();
  const supported =
    !!body &&
    !!routesQ.data?.combinations?.some(
      (r) =>
        r.origin.trim().toLowerCase() === body.origin.trim().toLowerCase() &&
        r.destination.trim().toLowerCase() === body.destination.trim().toLowerCase() &&
        r.vessel_type.trim().toLowerCase() === body.vessel.trim().toLowerCase(),
    );
  const routeReady = !!routesQ.data && supported;
  return useQuery<OptimizeResult & { _demo?: boolean }>({
    queryKey: ["optimize", body],
    queryFn: async () => {
      if (!body || !valid) throw new Error("Please choose a complete route and vessel selection.");
      try {
        return await api.optimize(body);
      } catch (e) {
        if (isOffline(e)) return { ...DEMO_OPTIMIZE, _demo: true };
        throw e;
      }
    },
    enabled: valid && routeReady,
    placeholderData: keepPreviousData,
    retry: 0,
  });
}

export function useRecommendationsHistory() {
  return useQuery<RecommendationHistoryItem[]>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      try {
        return await api.recommendationsHistory();
      } catch (e) {
        if (isOffline(e)) return DEMO_RECOMMENDATIONS;
        throw e;
      }
    },
    retry: 0,
  });
}

export function useScenariosHistory() {
  return useQuery<ScenarioHistoryItem[]>({
    queryKey: ["scenarios"],
    queryFn: async () => {
      try {
        return await api.scenariosHistory();
      } catch (e) {
        if (isOffline(e)) return DEMO_SCENARIOS;
        throw e;
      }
    },
    retry: 0,
  });
}

export function useModelRuns() {
  return useQuery<ModelRun[]>({
    queryKey: ["model-runs"],
    queryFn: async () => {
      try {
        return await api.modelRuns();
      } catch (e) {
        if (isOffline(e)) return DEMO_MODEL_RUNS;
        throw e;
      }
    },
    retry: 0,
  });
}

/** Integrated decision is a deliberate, explicit action (triggered by a
 * "Run Integrated Decision" button) rather than something that should fire
 * on every keystroke. A useQuery keyed on the live form input re-fires on
 * every field change, including invalid intermediate states while the user
 * is still typing — that produced the repeated 400s seen in backend logs.
 * useMutation only runs when .mutate()/.mutateAsync() is explicitly called,
 * and never auto-retries a deterministic validation failure. */
export function useIntegratedDecision() {
  return useMutation<
    IntegratedDecisionResult,
    ApiClientError,
    Parameters<typeof getIntegratedDecision>[0]
  >({
    mutationFn: (input) => getIntegratedDecision(input),
    retry: 0,
  });
}

export function useMarketSignals(origin?: string, vesselType?: string) {
  return useQuery({
    queryKey: ["market-signals", origin, vesselType],
    queryFn: () => getMarketSignals(origin, vesselType),
    retry: 0,
    staleTime: 60_000,
  });
}
