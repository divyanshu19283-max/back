// Shared adapter for the backend's procurement-option dict (keyed by
// strategy name: charter_now / wait_7_days / wait_30_days / wait_90_days)
// used by both the optimizer (/api/optimize) and the what-if simulator's
// alternative_scenarios (/api/whatif). Kept in one place so the two pages
// stay consistent.

import type { BackendOptionResult } from "../types";

export const OPTION_LABELS: Record<string, string> = {
  charter_now: "CHARTER NOW",
  wait_7_days: "WAIT 7 DAYS",
  wait_30_days: "WAIT 30 DAYS",
  wait_90_days: "WAIT 90 DAYS",
};

export const OPTION_DESCRIPTIONS: Record<string, string> = {
  charter_now: "Lock the current market rate today. Zero forecast exposure.",
  wait_7_days: "Delay 7 days and charter at the short-horizon predicted rate.",
  wait_30_days: "Delay 30 days and charter at the medium-horizon predicted rate.",
  wait_90_days: "Delay 90 days and charter at the long-horizon predicted rate.",
};

export function riskFromConfidence(confidence: number | null): "LOW" | "MEDIUM" | "HIGH" {
  if (confidence == null) return "MEDIUM";
  if (confidence >= 0.85) return "LOW";
  if (confidence >= 0.65) return "MEDIUM";
  return "HIGH";
}

export interface RankedOption {
  rank: number;
  action: string;
  label: string;
  description: string;
  total_cost: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  savings: number;
  freight_cost: number;
  fuel_cost: number;
  risk_adjustment: number;
}

/** Turns the backend's {name: OptionResult} dict into a cost-sorted array,
 * with savings measured against the `charter_now` baseline — the same
 * comparison the backend's own optimizer uses for `savings_vs_charter_now`. */
export function rankOptions(options: Record<string, BackendOptionResult>): RankedOption[] {
  const baseline = options["charter_now"]?.total_estimated_cost ?? 0;
  const entries = Object.entries(options).sort(
    (a, b) => a[1].total_estimated_cost - b[1].total_estimated_cost,
  );
  return entries.map(([key, opt], i) => {
    const label = OPTION_LABELS[key] ?? key.replace(/_/g, " ").toUpperCase();
    return {
      rank: i + 1,
      action: label,
      label,
      description: OPTION_DESCRIPTIONS[key] ?? "",
      total_cost: opt.total_estimated_cost,
      risk: riskFromConfidence(opt.confidence),
      confidence: (opt.confidence ?? 0) * 100,
      savings: baseline - opt.total_estimated_cost,
      freight_cost: opt.freight_cost,
      fuel_cost: opt.fuel_cost,
      risk_adjustment: opt.risk_adjustment,
    };
  });
}

export function labelForKey(key: string): string {
  return OPTION_LABELS[key] ?? key.replace(/_/g, " ").toUpperCase();
}
