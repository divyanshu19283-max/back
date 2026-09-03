// Forecast domain: POST /api/forecast, GET /api/forecast/history, and the
// real historical series (GET /api/data/history) combined client-side into
// the chart-ready `series` the ForecastChart component expects.

import { request } from "./client";
import type {
  BackendForecastResult,
  BackendForecastHistoryItem,
  BackendHistoryResponse,
  ForecastResult,
  ForecastHistoryItem,
  ForecastPoint,
} from "../types";

function adaptForecast(b: BackendForecastResult, series: ForecastPoint[]): ForecastResult {
  const expected_change_pct = b.current_rate
    ? ((b.predicted_rate - b.current_rate) / b.current_rate) * 100
    : 0;
  return {
    origin: b.origin,
    destination: b.destination,
    vessel: b.vessel_type,
    horizon: b.horizon_days,
    predicted_rate: b.predicted_rate,
    lower_bound: b.lower_bound,
    upper_bound: b.upper_bound,
    confidence: b.confidence_score * 100,
    model: b.model_name,
    as_of: b.as_of_date,
    current_rate: b.current_rate,
    expected_change_pct,
    series,
  };
}

/** Builds the chart series by combining the real historical rate points
 * with the single forecast point (with its confidence band). No values
 * are synthesized — every point is either an actual DB row or the model's
 * own prediction/bounds. */
function buildSeries(
  history: BackendHistoryResponse,
  forecast: BackendForecastResult,
): ForecastPoint[] {
  const points: ForecastPoint[] = history.points.map((p) => ({
    date: p.date,
    historical: p.rate,
    forecast: null,
    lower: null,
    upper: null,
  }));
  points.push({
    date: forecast.forecast_date,
    historical: null,
    forecast: forecast.predicted_rate,
    lower: forecast.lower_bound,
    upper: forecast.upper_bound,
  });
  return points;
}

/** Guards against the payload /api/forecast actually receives. Mirrors
 * the backend's ForecastRequest contract (origin/destination/vessel_type
 * as non-empty str, horizon_days as int) so a malformed selection is
 * caught here in plain, readable JS rather than surfacing as an opaque
 * 400/422 from the API. Does not change or duplicate the backend's own
 * validation (case/whitespace-insensitive route lookup) — it only
 * prevents obviously-bad values (blank, undefined, non-numeric horizon)
 * from ever being sent. */
function assertValidForecastInput(body: {
  origin: string;
  destination: string;
  vessel: string;
  horizon: number;
}) {
  const missing = (["origin", "destination", "vessel"] as const).filter((k) => !body[k]?.trim());
  if (missing.length) {
    throw new Error(`Cannot request a forecast without: ${missing.join(", ")}`);
  }
  if (!Number.isFinite(body.horizon) || body.horizon <= 0) {
    throw new Error(`Invalid forecast horizon: ${body.horizon}`);
  }
}

export async function getForecast(body: {
  origin: string;
  destination: string;
  vessel: string;
  horizon: number;
}): Promise<ForecastResult> {
  assertValidForecastInput(body);
  // Canonical values as chosen from the live /api/data/routes list (see
  // RouteSelector.tsx) — trimmed defensively so incidental whitespace
  // never turns a valid route into a false "no historical data" 400.
  // Field NAMES match the backend's existing ForecastRequest schema
  // (origin/destination/vessel_type/horizon_days) as-is; only the values
  // are normalized here, the contract itself is untouched.
  const origin = body.origin.trim();
  const destination = body.destination.trim();
  const vessel = body.vessel.trim();
  const backendBody = {
    origin,
    destination,
    vessel_type: vessel,
    horizon_days: body.horizon,
  };
  const [forecast, history] = await Promise.all([
    request<BackendForecastResult>("/api/forecast", {
      method: "POST",
      body: JSON.stringify(backendBody),
    }),
    request<BackendHistoryResponse>(
      `/api/data/history?${new URLSearchParams({
        origin,
        destination,
        vessel_type: vessel,
        limit: "90",
      })}`,
    ).catch(() => ({ origin, destination, vessel_type: vessel, points: [] })),
  ]);
  return adaptForecast(forecast, buildSeries(history, forecast));
}

export async function getForecastHistory(): Promise<ForecastHistoryItem[]> {
  const rows = await request<BackendForecastHistoryItem[]>("/api/forecast/history");
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    origin: r.origin,
    destination: r.destination,
    vessel: r.vessel_type,
    horizon: r.horizon_days,
    predicted_rate: r.predicted_rate,
    confidence: r.confidence_score * 100,
    model: r.model_name,
  }));
}
