import { motion } from "framer-motion";
import { useForecast, useOptimize } from "@/lib/hooks";
import { RouteSelector } from "@/components/RouteSelector";
import { FlowStrip } from "@/components/FlowStrip";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { DemoBadge, LiveBadge, SkeletonBlock, InlineError } from "@/components/states";
import { fmtInr, fmtPct, riskTone, changeTone } from "@/lib/format";
import { Check, Clock, Eye, ArrowRight, ListChecks } from "lucide-react";
import { useSelection } from "@/app/AppShell";

type DecisionState = "CHARTER NOW" | "WAIT 7 DAYS" | "WAIT 30 DAYS" | "WAIT 90 DAYS";

export function CharterDecision() {
  const { sel, setSel, goto: onNavigate } = useSelection();
  const forecastQ = useForecast(sel);
  const optimizeQ = useOptimize(sel);
  const f = forecastQ.data;
  const o = optimizeQ.data;
  const isDemo = !!f?._demo || !!o?._demo;
  const active = (o?.recommended ?? "") as DecisionState;
  const recommendedOption = o?.options.find((opt) => opt.label === o.recommended);
  const activeRisk = recommendedOption?.risk ?? "MEDIUM";

  const states: { id: DecisionState; icon: typeof Check; desc: string }[] = [
    { id: "CHARTER NOW", icon: Check, desc: "Lock the current rate. Zero exposure." },
    { id: "WAIT 7 DAYS", icon: Clock, desc: "Delay 7 days for the modeled entry." },
    { id: "WAIT 30 DAYS", icon: Eye, desc: "Delay 30 days for the modeled entry." },
    { id: "WAIT 90 DAYS", icon: Eye, desc: "Delay 90 days for the modeled entry." },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <h1 className="display text-[1.75rem] text-white">Charter Decision</h1>
          {isDemo ? <DemoBadge /> : f ? <LiveBadge /> : null}
        </div>
        <p className="text-sm text-ink-300">Risk-adjusted chartering recommendation.</p>
      </div>

      <div className="panel p-5">
        <RouteSelector value={sel} onChange={setSel} />
      </div>

      <FlowStrip
        steps={[
          { label: "Market", value: f ? `$${f.current_rate.toFixed(2)}` : "—" },
          { label: "Evidence", value: f?.model ?? "—" },
          { label: "Forecast", value: f ? `${fmtPct(f.expected_change_pct)}` : "—", tone: f ? changeTone(f.expected_change_pct).includes("danger") ? "negative" : "positive" : "neutral" },
          { label: "Risk", value: activeRisk, tone: "neutral" },
          { label: "Recommended Action", value: active || "—", tone: "accent" },
        ]}
      />

      {/* Decision ladder — a single instrument, not four competing cards */}
      <div className="border border-white/[0.07] bg-ink-900">
        {states.map((s, i) => {
          const isActive = s.id === active;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className={`group flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 ${
                i > 0 ? "border-t border-white/[0.06]" : ""
              } ${isActive ? "bg-accent-500/[0.06]" : "hover:bg-white/[0.02]"}`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-accent-400" : "bg-ink-700"}`}
              />
              <s.icon
                className={`h-4 w-4 shrink-0 ${isActive ? "text-accent-400" : "text-ink-500"}`}
                strokeWidth={1.75}
              />
              <span
                className={`w-36 shrink-0 text-sm font-medium ${isActive ? "text-white" : "text-ink-300"}`}
              >
                {s.id}
              </span>
              <span className="hidden flex-1 text-xs text-ink-400 sm:block">{s.desc}</span>
              {isActive && (
                <span className="label-mono shrink-0 text-accent-300">Recommended</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Decision detail */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white">Decision summary</h2>
          <p className="mt-1 text-xs text-ink-400">
            {sel.origin} → {sel.destination} · {sel.vessel}
          </p>

          {forecastQ.isLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-10" />
              ))}
            </div>
          ) : forecastQ.isError ? (
            <div className="mt-4">
              <InlineError error={forecastQ.error} onRetry={() => forecastQ.refetch()} />
            </div>
          ) : f ? (
            <div className="mt-5 space-y-3">
              <DetailRow label="Decision" value={o?.recommended ?? "—"} tone="text-accent-300" />
              <DetailRow
                label="Confidence"
                value={`${f.confidence.toFixed(1)}%`}
                tone="text-success-400"
              />
              <DetailRow label="Risk" value={activeRisk} tone={riskTone(activeRisk).text} />
              <DetailRow
                label="Expected savings"
                value={recommendedOption ? fmtInr(recommendedOption.savings) : "—"}
                tone="text-success-400"
              />
              <DetailRow
                label="Expected movement"
                value={fmtPct(f.expected_change_pct)}
                tone={changeTone(f.expected_change_pct)}
              />
              <div className="my-2 divider" />
              <div>
                <div className="label-mono mb-2">Reason</div>
                <p className="text-sm leading-relaxed text-ink-300">
                  {f.reason ??
                    "Recommendation is based on the live forecast and risk-adjusted procurement optimizer."}
                </p>
              </div>
            </div>
          ) : null}

          <button
            onClick={() => onNavigate("whatif")}
            className="btn-primary mt-6 w-full sm:w-auto"
          >
            Run What-If Analysis
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Decision factors */}
        <div className="panel p-6">
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-accent-300" />
            <h2 className="text-base font-semibold text-white">Decision factors</h2>
          </div>
          <div className="space-y-2.5">
            <Factor
              label="Forecast movement"
              value={f ? fmtPct(f.expected_change_pct) : "—"}
              tone={f ? changeTone(f.expected_change_pct) : ""}
            />
            <Factor
              label="Confidence"
              value={f ? `${f.confidence.toFixed(1)}%` : "—"}
              tone="text-success-400"
            />
            <Factor label="Current rate" value={f ? `$${f.current_rate.toFixed(2)}` : "—"} />
            <Factor
              label="Future rate"
              value={f ? `$${f.predicted_rate.toFixed(2)}` : "—"}
              tone="text-accent-300"
            />
            <Factor label="Risk adjustment" value={activeRisk} tone={riskTone(activeRisk).text} />
          </div>
          {o && (
            <>
              <div className="my-4 divider" />
              <div className="label-mono mb-1.5">Recommended</div>
              <div className="text-lg font-semibold text-accent-300">{o.recommended}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
      <span className="text-sm text-ink-400">{label}</span>
      <span className={`num text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function Factor({
  label,
  value,
  tone = "text-ink-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2">
      <span className="text-xs text-ink-300">{label}</span>
      <span className={`num text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
