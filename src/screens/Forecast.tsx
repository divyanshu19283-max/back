import { motion } from "framer-motion";
import { useForecast } from "@/lib/hooks";
import { RouteSelector } from "@/components/RouteSelector";
import { ForecastChart } from "@/components/ForecastChart";
import { FlowStrip } from "@/components/FlowStrip";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { DemoBadge, LiveBadge, SkeletonBlock, InlineError } from "@/components/states";
import { fmtUsd, fmtPct, changeTone } from "@/lib/format";
import { Brain, HelpCircle } from "lucide-react";
import { useSelection } from "@/app/AppShell";

export function Forecast() {
  const { sel, setSel } = useSelection();
  const q = useForecast(sel);
  const f = q.data;
  const isDemo = !!f?._demo;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="display text-[1.75rem] text-white">Forecast Intelligence</h1>
          {isDemo ? <DemoBadge /> : f ? <LiveBadge /> : null}
        </div>
        <p className="text-sm text-ink-300">Model-projected freight rate across horizons.</p>
      </div>

      <div className="panel p-4">
        <RouteSelector value={sel} onChange={setSel} />
      </div>

      {/* Centerpiece: chart dominant, metrics as a dense side ledger rather
          than a row of equal-weight cards competing with it. */}
      <div className="grid gap-px overflow-hidden border border-white/[0.07] bg-white/[0.06] lg:grid-cols-[1fr_240px]">
        <div className="bg-ink-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Freight rate — {sel.horizon}D outlook</h2>
              <p className="text-xs text-ink-400">
                {sel.origin} → {sel.destination} · {sel.vessel}
              </p>
            </div>
            <span className="chip border-accent-500/30 bg-accent-500/10 text-accent-200">
              <Brain className="h-3 w-3" /> {f?.model ?? "Gradient Boosting"}
            </span>
          </div>
          {q.isLoading ? (
            <SkeletonBlock className="h-[420px] w-full" />
          ) : q.isError ? (
            <InlineError error={q.error} onRetry={() => q.refetch()} />
          ) : f ? (
            <>
              <ForecastChart series={f.series} currentRate={f.current_rate} height={420} />
              {isDemo && (
                <p className="mt-3 text-center text-xs text-amber-300/80">
                  Illustrative data — backend unavailable.
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className="flex flex-col divide-y divide-white/[0.06] bg-ink-900">
          {q.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4">
                <SkeletonBlock className="h-9 w-full" />
              </div>
            ))
          ) : f ? (
            <>
              <Ledger label="Predicted rate" value={fmtUsd(f.predicted_rate)} tone="text-accent-300" />
              <Ledger label="Lower bound" value={fmtUsd(f.lower_bound)} tone="text-success-400" />
              <Ledger label="Upper bound" value={fmtUsd(f.upper_bound)} tone="text-danger-400" />
              <Ledger label="Confidence" value={`${f.confidence.toFixed(1)}%`} />
              <Ledger label="Model" value={f.model} mono={false} />
              <Ledger label="As-of date" value={f.as_of} mono={false} />
            </>
          ) : null}
        </div>
      </div>

      {/* Why this forecast */}
      {f && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="panel p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-accent-300" />
            <h2 className="text-base font-semibold text-white">Why this forecast?</h2>
          </div>
          <p className="text-sm leading-relaxed text-ink-300">
            {f.reason ??
              `The ${f.model} model projects a ${f.expected_change_pct >= 0 ? "rise" : "decline"} of ${fmtPct(Math.abs(f.expected_change_pct))} over ${sel.horizon} days, with ${f.confidence.toFixed(1)}% confidence and a range of ${fmtUsd(f.lower_bound)} to ${fmtUsd(f.upper_bound)}.`}
          </p>
          <div className="mt-4">
            <FlowStrip
              steps={[
                { label: "Current rate", value: fmtUsd(f.current_rate) },
                { label: "Predicted", value: fmtUsd(f.predicted_rate), tone: "accent" },
                {
                  label: "Change",
                  value: fmtPct(f.expected_change_pct),
                  tone: changeTone(f.expected_change_pct).includes("danger") ? "negative" : "positive",
                },
                { label: "Confidence", value: `${f.confidence.toFixed(1)}%`, tone: "positive" },
              ]}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Ledger({
  label,
  value,
  tone = "text-white",
  mono = true,
}: {
  label: string;
  value: string;
  tone?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="label-mono">{label}</span>
      <span className={`${mono ? "num" : ""} text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
