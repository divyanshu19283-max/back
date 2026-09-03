import { motion } from "framer-motion";
import { useOptimize } from "@/lib/hooks";
import { RouteSelector } from "@/components/RouteSelector";
import { DemoBadge, SkeletonBlock, InlineError } from "@/components/states";
import { fmtInr, riskTone } from "@/lib/format";
import { Trophy, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { useSelection } from "@/app/AppShell";

export function Optimization() {
  const { sel, setSel, goto: onNavigate } = useSelection();
  const q = useOptimize(sel);
  const o = q.data;
  const isDemo = !!o?._demo;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Procurement Optimizer
          </h1>
          {isDemo && <DemoBadge />}
        </div>
        <p className="text-sm text-slate-400">
          Find the lowest risk-adjusted procurement strategy.
        </p>
      </div>

      <div className="panel p-4">
        <RouteSelector value={sel} onChange={setSel} />
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[88px]" />
          ))}
        </div>
      ) : q.isError ? (
        <InlineError error={q.error} onRetry={() => q.refetch()} />
      ) : o ? (
        <>
          {/* Recommended banner */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel border-l-2 border-l-success-500 p-5"
          >
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-success-400" strokeWidth={1.75} />
                <div>
                  <div className="kicker">Recommended strategy</div>
                  <div className="text-xl font-semibold text-white">{o.recommended}</div>
                </div>
              </div>
              <button onClick={() => onNavigate("charter")} className="btn-ghost">
                View decision <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          {/* Ranked options */}
          <div className="space-y-3">
            {o.options.map((opt, i) => {
              const isBest = opt.action === o.recommended;
              const tone = riskTone(opt.risk);
              return (
                <motion.div
                  key={opt.action}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className={`panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${isBest ? "border-l-2 border-l-success-500" : ""}`}
                >
                  {/* Rank */}
                  <div className="flex items-center gap-4 sm:w-48">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-md font-mono text-sm font-semibold ${isBest ? "bg-success-500/10 text-success-400" : "bg-white/[0.04] text-slate-400"}`}
                    >
                      {String(opt.rank).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{opt.label}</span>
                        {isBest && <ShieldCheck className="h-4 w-4 text-success-400" />}
                      </div>
                      <div className="text-xs text-slate-500">{opt.description}</div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric
                      label="Total cost"
                      value={fmtInr(opt.total_cost)}
                      tone={isBest ? "text-success-400" : "text-white"}
                    />
                    <Metric label="Risk" value={opt.risk} tone={tone.text} />
                    <Metric
                      label="Confidence"
                      value={`${opt.confidence.toFixed(1)}%`}
                      tone="text-accent-300"
                    />
                    <Metric
                      label="Savings"
                      value={`${opt.savings >= 0 ? "+" : "-"}${fmtInr(Math.abs(opt.savings))}`}
                      tone={opt.savings >= 0 ? "text-success-400" : "text-danger-400"}
                    />
                  </div>

                  {isBest && (
                    <span className="absolute right-4 top-4 chip border-success-500/40 bg-success-500/15 text-success-300">
                      <Check className="h-3 w-3" /> Best
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {isDemo && (
            <p className="text-center text-xs text-amber-300/80">
              Illustrative ranking — backend unavailable.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="label-mono">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold num ${tone}`}>{value}</div>
    </div>
  );
}
