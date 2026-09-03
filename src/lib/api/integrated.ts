import { request } from "./client";
import type { IntegratedDecisionResult, MarketSignals } from "../types";

export async function getIntegratedDecision(input: {
  originId: string;
  portId: string;
  cargoQuantity: number;
  cargoType: string;
  currentFreightRate: number;
  fuelPrice: number;
  vesselPreference?: string;
}) {
  return request<IntegratedDecisionResult>("/api/maritime/integrated-decision", {
    method: "POST",
    body: JSON.stringify({
      origin_id: input.originId,
      port_id: input.portId,
      cargo_quantity: input.cargoQuantity,
      cargo_type: input.cargoType,
      current_freight_rate: input.currentFreightRate,
      fuel_price: input.fuelPrice,
      vessel_preference: input.vesselPreference,
    }),
  });
}

export async function getMarketSignals(origin?: string, vesselType?: string) {
  const p = new URLSearchParams();
  if (origin) p.set("origin", origin);
  if (vesselType) p.set("vessel_type", vesselType);
  return request<MarketSignals>(`/api/maritime/market-signals?${p}`);
}
