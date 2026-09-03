import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Ship,
  ShieldAlert,
  Route,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowRight,
  Loader2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { useIntegratedDecision, useMarketSignals } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { BackendOrigin, BackendPort } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { fmtInr } from "@/lib/format";
import { LiveBadge, DemoBadge, SkeletonBlock } from "@/components/states";
import { useSelection } from "@/app/AppShell";

/** Everything the backend requires for a valid /integrated-decision call.
 * Checked on the frontend before the button is enabled / before submit, so
 * we never send an intermediate/invalid request just because the user is
 * mid-edit on a field. */
function validate(input: {
  originId: string;
  portId: string;
  cargoType: string;
  cargoQuantity: number;
  rate: number;
  fuel: number;
  vesselCapacity?: number | undefined;
}): string[] {
  const errors: string[] = [];
  if (!input.originId?.trim()) errors.push("Select an origin.");
  if (!input.portId?.trim()) errors.push("Select a discharge port.");
  if (!input.cargoType?.trim()) errors.push("Select a cargo type.");
  if (!Number.isFinite(input.cargoQuantity) || input.cargoQuantity <= 0)
    errors.push("Cargo quantity must be greater than 0.");
  if (!Number.isFinite(input.rate) || input.rate <= 0)
    errors.push("Current freight rate must be greater than 0.");
  if (!Number.isFinite(input.fuel) || input.fuel <= 0)
    errors.push("Fuel price must be greater than 0.");
  if (input.vesselCapacity && input.cargoQuantity > input.vesselCapacity)
    errors.push(
      `Cargo exceeds selected vessel capacity (${input.vesselCapacity.toLocaleString()} t).`,
    );
  return errors;
}

export function MaritimeOperations() {
  const { maritimeOriginId: initialOriginId, maritimePortId: initialPortId } = useSelection();
  const { data: origins } = useQuery({
    queryKey: ["origins"],
    queryFn: () => api.origins(),
    retry: 0,
    staleTime: 300_000,
  });
  const { data: ports } = useQuery({
    queryKey: ["ports"],
    queryFn: () => api.listPorts(),
    retry: 0,
    staleTime: 300_000,
  });
  const { data: vessels } = useQuery({
    queryKey: ["vessels"],
    queryFn: () => api.listVessels(),
    retry: 0,
    staleTime: 300_000,
  });
  const [originId, setOriginId] = useState(initialOriginId ?? "australia");
  const [portId, setPortId] = useState(initialPortId ?? "paradip");

  // A search result selected while already on this page (or a value passed
  // in from search before mount) should still land in the selects — sync
  // whenever the caller hands us a new initial id.
  useEffect(() => {
    if (initialOriginId) setOriginId(initialOriginId);
  }, [initialOriginId]);
  useEffect(() => {
    if (initialPortId) setPortId(initialPortId);
  }, [initialPortId]);
  const [cargoType, setCargoType] = useState("Coal");
  const [cargoQuantity, setCargoQuantity] = useState(50000);
  const [rate, setRate] = useState(65.96);
  const [fuel, setFuel] = useState(620);
  const [vesselPreference, setVesselPreference] = useState("");
  const [touched, setTouched] = useState(false);
  const selectedPort = ports?.find((p) => p.id === portId);
  const selectedVessel = vessels?.find((v) => v.vessel_type === vesselPreference);
  const validationErrors = useMemo(
    () =>
      validate({
        originId,
        portId,
        cargoType,
        cargoQuantity,
        rate,
        fuel,
        vesselCapacity: selectedVessel?.cargo_capacity,
      }),
    [originId, portId, cargoType, cargoQuantity, rate, fuel, selectedVessel?.cargo_capacity],
  );
  const isValid = validationErrors.length === 0;

  const decision = useIntegratedDecision();
  const d = decision.data;
  const signals = useMarketSignals(originId, vesselPreference || undefined);

  function runIntegratedDecision() {
    setTouched(true);
    if (!isValid || decision.isPending) return;
    decision.mutate({
      originId,
      portId,
      cargoQuantity,
      cargoType,
      currentFreightRate: rate,
      fuelPrice: fuel,
      ...(vesselPreference ? { vesselPreference } : {}),
    });
  }

  const backendErrorMessage = decision.isError
    ? decision.error?.message ||
      "The decision engine could not process this request. Please review your inputs and try again."
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">Maritime Operations</h1>
            <LiveBadge />
          </div>
          <p className="text-sm text-slate-400">
            SIH26006 integrated contract, vessel, port, idle-time and risk decision engine.
          </p>
        </div>
        <div className="chip border-white/10 bg-white/[0.03] text-slate-300">
          <Database className="h-3 w-3" /> Provenance-aware
        </div>
      </header>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Route className="h-4 w-4 text-accent-300" />
          <h2 className="text-base font-semibold text-white">Procurement brief</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Origin">
            <select
              className="select"
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
            >
              {(origins ?? []).map((o: BackendOrigin) => (
                <option key={o.id} value={o.id}>
                  {o.region}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Discharge port">
            <select className="select" value={portId} onChange={(e) => setPortId(e.target.value)}>
              {(ports ?? []).map((p: BackendPort) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo">
            <select
              className="select"
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
            >
              {["Coal", "Iron Ore", "Grain", "Bauxite", "Fertilizer", "Limestone"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Vessel preference">
            <select
              className="select"
              value={vesselPreference}
              onChange={(e) => {
                const next = e.target.value;
                setVesselPreference(next);
              }}
            >
              <option value="">AI select best</option>
              {(vessels ?? []).map((v: import("@/lib/types").BackendVessel) => (
                <option key={v.id} value={v.vessel_type}>
                  {v.vessel_type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo quantity (t)">
            <input
              className="input"
              type="number"
              min={1}
              value={cargoQuantity}
              onChange={(e) => setCargoQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Current freight ($/t)">
            <input
              className="input"
              type="number"
              min={1}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </Field>
          <Field label="Fuel price ($/t)">
            <input
              className="input"
              type="number"
              min={1}
              value={fuel}
              onChange={(e) => setFuel(Number(e.target.value))}
            />
          </Field>
          <div className="flex items-end">
            <div className="w-full rounded-lg border border-accent-500/20 bg-accent-500/[0.06] px-4 py-3 text-xs text-accent-200">
              Target: choose a contract duration and vessel that minimizes risk-adjusted delivered
              cost.
            </div>
          </div>
        </div>

        {touched && !isValid && (
          <div className="mt-4 rounded-lg border border-warn-500/25 bg-warn-500/[0.06] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-warn-300">
              <AlertTriangle className="h-4 w-4" />
              Fix the following before running the decision engine
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-warn-200">
              {validationErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={runIntegratedDecision}
            disabled={decision.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {decision.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {decision.isPending ? "Running…" : "Run Integrated Decision"}
          </button>
          {!decision.isPending && d && !decision.isError && (
            <span className="inline-flex items-center gap-1.5 text-xs text-success-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Last run completed successfully
            </span>
          )}
        </div>
      </section>

      {decision.isPending ? (
        <div className="space-y-3">
          <div className="panel flex items-center gap-3 p-4 text-sm text-accent-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing route, vessel economics, freight forecast and market signals…
          </div>
          <SkeletonBlock className="h-28" />
          <SkeletonBlock className="h-56" />
        </div>
      ) : decision.isError ? (
        <div className="panel border-danger-500/30 bg-danger-500/[0.04] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-danger-300">
            <XCircle className="h-4 w-4" /> Integrated decision could not be completed
          </div>
          <p className="mt-2 text-sm leading-relaxed text-danger-200/90">{backendErrorMessage}</p>
          <p className="mt-3 text-xs text-slate-500">
            Review the procurement brief above and click "Run Integrated Decision" again — the
            request is not retried automatically.
          </p>
        </div>
      ) : d ? (
        <>
          {d.input_adjusted && (
            <section className="panel border-warn-500/30 bg-warn-500/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-warn-300">
                <AlertTriangle className="h-4 w-4" />
                Input adjusted to a feasible bundled-data configuration
              </div>
              <p className="mt-1 text-xs leading-relaxed text-warn-200/80">
                The requested combination could not be evaluated directly. The evaluated inputs are
                shown below so the recommendation is not presented as if the original request was
                used unchanged.
              </p>
            </section>
          )}
          <section className="grid gap-4 lg:grid-cols-4">
            <Hero
              title="Recommended contract"
              value={`${d.recommendation.contract} · ${d.recommendation.voyages} voyages`}
              icon={<Route />}
            />
            <Hero title="Recommended vessel" value={d.recommendation.vessel_type} icon={<Ship />} />
            <Hero title="Port" value={d.recommendation.port} icon={<Anchor />} />
            <Hero
              title="Idle exposure"
              value={`${d.idle_management.current_idle_days.toFixed(1)} days`}
              icon={<Clock3 />}
            />
          </section>

          <section className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Market & economic signals</h2>
                <p className="text-xs text-slate-500">
                  Historical demand/supply, fuel and congestion features used by the decision layer.
                  Current bundled dataset is synthetic and replaceable.
                </p>
              </div>
              <DemoBadge />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Signal
                label="Freight rate"
                value={
                  signals.data?.freight_rate ? `$${signals.data.freight_rate.toFixed(2)}/t` : "—"
                }
              />
              <Signal
                label="Fuel"
                value={signals.data?.fuel_price ? `$${signals.data.fuel_price.toFixed(0)}/t` : "—"}
              />
              <Signal label="Demand index" value={signals.data?.demand_index?.toFixed(1) ?? "—"} />
              <Signal label="Supply index" value={signals.data?.supply_index?.toFixed(1) ?? "—"} />
              <Signal
                label="Demand − supply"
                value={signals.data?.demand_supply_pressure?.toFixed(1) ?? "—"}
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="panel p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Spot → multiple-voyage contract optimization
                  </h2>
                  <p className="text-xs text-slate-500">
                    Lower total cost includes freight, fuel, congestion idle cost, uncertainty and
                    commitment risk.
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-success-400" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3">Contract</th>
                      <th>Rate/t</th>
                      <th>Confidence</th>
                      <th>Total cost</th>
                      <th>vs spot</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.contract_options.map((x) => (
                      <tr
                        key={x.voyages}
                        className={`border-t border-white/[0.05] ${x.voyages === d.recommendation.voyages ? "bg-success-500/[0.04]" : ""}`}
                      >
                        <td className="py-3 font-semibold text-white">{x.label}</td>
                        <td className="num text-slate-200">${x.effective_rate.toFixed(2)}</td>
                        <td className="num text-accent-300">{(x.confidence * 100).toFixed(0)}%</td>
                        <td className="num text-white">{fmtInr(x.total_cost)}</td>
                        <td
                          className={`num ${x.savings_vs_spot >= 0 ? "text-success-400" : "text-danger-400"}`}
                        >
                          {fmtInr(x.savings_vs_spot)}
                        </td>
                        <td>
                          {x.voyages === d.recommendation.voyages && (
                            <span className="chip border-success-500/30 bg-success-500/10 text-success-300">
                              Recommended
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-slate-400">
                {d.recommendation.reason}
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="text-base font-semibold text-white">Risk mitigation</h2>
              <div className="mt-4 space-y-3">
                {d.risk_alerts.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-warn-400" />
                      <span className="text-xs font-semibold text-white">
                        {r.level} · {r.type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{r.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-5">
              <h2 className="text-base font-semibold text-white">Vessel type optimization</h2>
              <div className="mt-4 space-y-2">
                {d.vessel_ranking.map((v, i) => (
                  <div key={v.vessel_id} className="rounded-lg border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white">
                          {i + 1}. {v.vessel_type}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {v.cargo_capacity.toLocaleString()} t capacity
                        </span>
                      </div>
                      <span className="num text-accent-300">Score {v.score.toFixed(1)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <span>Draft {v.draft}m</span>
                      <span>LOA {v.loa}m</span>
                      <span>Beam {v.beam}m</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      {v.feasibility.reasons.length
                        ? v.feasibility.reasons.join(" · ")
                        : "All hard port/cargo checks passed."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-5">
              <h2 className="text-base font-semibold text-white">Idle scenario management</h2>
              <div className="mt-3 rounded-lg border border-warn-500/20 bg-warn-500/[0.04] p-4">
                <div className="text-xs text-slate-500">Recommended strategy</div>
                <div className="mt-1 text-lg font-semibold text-warn-300">
                  {d.idle_management.recommended_strategy}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {d.idle_management.deadheading_note}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {d.idle_management.alternatives.map((a) => (
                  <div
                    key={a.port_id}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{a.port_name}</div>
                      <div className="text-xs text-slate-500">
                        {a.congestion_level} · {a.reposition_days}d reposition · $
                        {a.reposition_cost_usd.toLocaleString()} cost
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warn-400" />
              <h2 className="text-base font-semibold text-white">
                Data provenance & operational assumptions
              </h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-xs">
              <Prov label="Market history" value={d.data_provenance.market_history} />
              <Prov label="Port master" value={d.data_provenance.port_master} />
              <Prov label="Distance" value={d.data_provenance.route_distance} />
              <Prov
                label="Live port feed"
                value={
                  d.data_provenance.live_port_feed ? "CONNECTED" : "NOT CONNECTED — demo/assumed"
                }
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label-mono">{label}</label>
      {children}
    </div>
  );
}
function Hero({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="label-mono">{label}</div>
      <div className="mt-1 num text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
function Prov({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="label-mono">{label}</div>
      <div className="mt-1 text-slate-300">{value}</div>
    </div>
  );
}
