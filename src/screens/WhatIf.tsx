import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhatIf, useRoutes } from "@/lib/hooks";
import { CostComparison, CostBreakdownCards } from "@/components/CostComparison";
import { DemoBadge, SkeletonBlock, InlineError } from "@/components/states";
import { fmtInr } from "@/lib/format";
import { SlidersHorizontal, Ship, Fuel, Boxes, Play, RotateCcw } from "lucide-react";
import type { WhatIfInput } from "@/lib/types";
import { useSelection } from "@/app/AppShell";

/** Combined "Origin → Destination" strings used by the Route dropdown map
 * onto the shared { origin, destination } selection kept in AppShell. */
const toRouteLabel = (origin: string, destination: string) => `${origin} → ${destination}`;
const splitRouteLabel = (label: string): { origin: string; destination: string } | null => {
  const [origin, destination] = label.split(" → ");
  return origin && destination ? { origin, destination } : null;
};

export function WhatIf() {
  const { data: routes } = useRoutes();
  const mutation = useWhatIf();
  const { sel, setSel } = useSelection();

  // Cargo/rate/fuel assumptions are local to this scenario tool; route,
  // vessel and horizon stay in sync with the app-wide route selection so a
  // choice made here (or on any other screen) carries everywhere else.
  const [input, setInput] = useState<WhatIfInput>({
    cargo_quantity: 50000,
    current_freight_rate: 65.96,
    fuel_price: 620,
    route: toRouteLabel(sel.origin, sel.destination),
    vessel: sel.vessel,
    horizon: sel.horizon,
  });

  // Reflect a route/vessel/horizon change made on another screen.
  useEffect(() => {
    setInput((prev) => ({
      ...prev,
      route: toRouteLabel(sel.origin, sel.destination),
      vessel: sel.vessel,
      horizon: sel.horizon,
    }));
  }, [sel.origin, sel.destination, sel.vessel, sel.horizon]);

  const updateRoute = (label: string) => {
    const parsed = splitRouteLabel(label);
    setInput({ ...input, route: label });
    if (parsed) setSel({ ...sel, origin: parsed.origin, destination: parsed.destination });
  };
  const updateVessel = (vessel: string) => {
    setInput({ ...input, vessel });
    setSel({ ...sel, vessel });
  };
  const updateHorizon = (horizon: number) => {
    setInput({ ...input, horizon });
    setSel({ ...sel, horizon });
  };

  const result = mutation.data;
  const isDemo = !!result?._demo;

  const simulate = () => mutation.mutate(input);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">What-If Simulator</h1>
        <p className="text-sm text-slate-400">Model cost outcomes under your own assumptions.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Inputs */}
        <div className="panel p-5 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-accent-300" />
            <h2 className="text-base font-semibold text-white">Scenario Inputs</h2>
          </div>

          <div className="space-y-5">
            <SliderField
              icon={Boxes}
              label="Cargo quantity (tonnes)"
              value={input.cargo_quantity}
              min={10000}
              max={200000}
              step={1000}
              onChange={(v) => setInput({ ...input, cargo_quantity: v })}
            />
            <SliderField
              icon={Ship}
              label="Current freight rate ($/t)"
              value={input.current_freight_rate}
              min={10}
              max={150}
              step={0.5}
              decimals={2}
              prefix="$"
              onChange={(v) => setInput({ ...input, current_freight_rate: v })}
            />
            <SliderField
              icon={Fuel}
              label="Fuel price ($/t)"
              value={input.fuel_price}
              min={200}
              max={1200}
              step={10}
              onChange={(v) => setInput({ ...input, fuel_price: v })}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="label-mono">Route</label>
                <select
                  className="select"
                  value={input.route}
                  onChange={(e) => updateRoute(e.target.value)}
                >
                  {(routes?.routes ?? [])
                    .flatMap((r) => r.destinations.map((d) => toRouteLabel(r.origin, d)))
                    .map((rt) => (
                      <option key={rt} value={rt}>
                        {rt}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-mono">Vessel</label>
                <select
                  className="select"
                  value={input.vessel}
                  onChange={(e) => updateVessel(e.target.value)}
                >
                  {(routes?.vessel_types ?? []).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label-mono">Horizon</label>
              <div className="flex rounded-lg border border-white/[0.07] bg-ink-800/70 p-0.5">
                {[7, 30, 90].map((h) => (
                  <button
                    key={h}
                    onClick={() => updateHorizon(h)}
                    className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition ${
                      input.horizon === h
                        ? "bg-white/[0.07] text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {h}D
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={simulate}
              disabled={mutation.isPending}
              className="btn-primary w-full py-3 text-base"
            >
              {mutation.isPending ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" /> Simulating…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Simulate Scenario
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="panel p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Scenario Results</h2>
            {isDemo && <DemoBadge />}
          </div>

          <AnimatePresence mode="wait">
            {mutation.isPending ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SkeletonBlock className="h-[260px] w-full" />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-[140px]" />
                  ))}
                </div>
              </motion.div>
            ) : mutation.isError ? (
              <motion.div
                key="err"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <InlineError />
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="chip border-white/10 bg-white/[0.04] text-slate-300">
                    {input.cargo_quantity.toLocaleString()} t
                  </span>
                  <span className="chip border-white/10 bg-white/[0.04] text-slate-300">
                    ${input.current_freight_rate}/t
                  </span>
                  <span className="chip border-white/10 bg-white/[0.04] text-slate-300">
                    Fuel ${input.fuel_price}/t
                  </span>
                  <span className="chip border-accent-500/30 bg-accent-500/10 text-accent-200">
                    {input.horizon}D
                  </span>
                </div>

                <CostComparison
                  options={result.options}
                  recommended={result.recommended}
                  height={240}
                />
                <div className="mt-5">
                  <CostBreakdownCards options={result.options} recommended={result.recommended} />
                </div>

                {isDemo && (
                  <p className="mt-4 text-center text-xs text-amber-300/80">
                    Illustrative scenario — backend unavailable.
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-500"
              >
                <Play className="h-6 w-6 opacity-40" />
                <p className="text-sm">
                  Adjust the inputs and run a simulation to see projected costs.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  icon: Icon,
  label,
  value,
  min,
  max,
  step,
  decimals = 0,
  prefix = "",
  onChange,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  prefix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label-mono flex items-center gap-1.5">
          <Icon className="h-3 w-3" /> {label}
        </label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 rounded-md border border-white/[0.07] bg-ink-800/70 px-2 py-1 text-right text-sm font-semibold text-white num focus:border-accent-500/60 focus:outline-none"
        />
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-500"
      />
      <div className="flex justify-between text-2xs text-slate-600">
        <span>
          {prefix}
          {min.toLocaleString()}
        </span>
        <span>
          {prefix}
          {max.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
