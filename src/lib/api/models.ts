// Model intelligence domain: GET /api/model-runs (persisted training-run
// metrics written by scripts/record_model_runs.py from the real training
// pipeline in app/ml/train.py).

import { request } from "./client";
import type { BackendModelRun, ModelRun } from "../types";

export async function getModelRuns(): Promise<ModelRun[]> {
  const rows = await request<BackendModelRun[]>("/api/model-runs");
  return rows.map((r) => ({
    id: r.id,
    horizon: r.horizon_days,
    model: r.model_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    mae: r.mae,
    rmse: r.rmse,
    mape: r.mape,
    r2: r.r2,
    created_at: r.created_at,
    is_best_model: r.is_best_model,
  }));
}
