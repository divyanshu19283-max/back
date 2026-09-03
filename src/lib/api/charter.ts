// Charter decision domain: GET /api/recommendations/history (persisted
// output of the rules-based decision engine in app/services/decision_engine.py,
// written every time a what-if scenario is saved).

import { request } from "./client";
import type { BackendRecommendationHistoryItem, RecommendationHistoryItem } from "../types";

export async function getRecommendationsHistory(): Promise<RecommendationHistoryItem[]> {
  const rows = await request<BackendRecommendationHistoryItem[]>("/api/recommendations/history");
  return rows.map((r) => ({
    id: r.id,
    date: r.created_at,
    origin: r.origin,
    destination: r.destination,
    vessel: r.vessel_size,
    action: r.recommendation,
    confidence: r.confidence * 100,
    risk: r.risk_level,
    savings: r.expected_saving,
  }));
}
