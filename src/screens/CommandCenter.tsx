import { useForecast, useOptimize } from "@/lib/hooks";
import { RouteSelector } from "@/components/RouteSelector";
import { ForecastChart } from "@/components/ForecastChart";
import { KpiCard, TrendPill } from "@/components/KpiCard";
import { CostComparison, CostBreakdownCards } from "@/components/CostComparison";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { FlowStrip } from "@/components/FlowStrip";
import { DemoBadge, LiveBadge, SkeletonBlock, InlineError } from "@/components/states";
import { fmtPct, fmtInr, riskTone, changeTone } from "@/lib/format";
import { ArrowRight, DollarSign, TrendingUp, Activity, Gauge } from "lucide-react";
import { useSelection } from "@/app/AppShell";

export function CommandCenter() {
  const { sel, setSel, goto: onNavigate } = useSelection();
  const forecastQ = useForecast(sel);
  const optimizeQ = useOptimize(sel);

  const f = forecastQ.data;
  const o = optimizeQ.data;
  const isDemo = !!f?._demo || !!o?._demo;
  const recommendedOption = o?.options.find((opt) => opt.label === o.recommended) ?? o?.options[0];
  const risk = riskTone(recommendedOption?.risk ?? "MEDIUM");
  const recommendation = o?.recommended ?? "—";
  const expectedSaving = recommendedOption?.savings ?? 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <h1 className="display text-[1.75rem] text-white">Command Center</h1>
          {isDemo ? <DemoBadge /> : f ? <LiveBadge /> : null}
        </div>
        <p className="text-sm text-ink-300">
          {sel.origin} → {sel.destination} · {sel.vessel} · market intelligence for your next
          procurement decision.
        </p>
      </div>

      {/* Evidence pipeline — the causal chain behind the recommendation below */}
      <FlowStrip
        steps={[
          { label: "Market", value: f ? `$${f.current_rate.toFixed(2)}` : "—" },
          { label: "Evidence", value: f?.model ?? "—" },
          {
            label: "Forecast",
            value: f ? `$${f.predicted_rate.toFixed(2)}` : "—",
            tone: "accent",
          },
          {
            label: "Risk",
            value: recommendedOption?.risk ?? "—",
            tone: risk.text.includes("danger") ? "negative" : risk.text.includes("success") ? "positive" : "neutral",
          },
          { label: "Recommended Action", value: recommendation, tone: "accent" },
        ]}
      />

      {/* Route selector */}
      <div className="panel p-5">
        <RouteSelector value={sel} onChange={setSel} />
      </div>

      {/* KPI cards */}
      {forecastQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[100px]" />
          ))}
        </div>
      ) : forecastQ.isError ? (
        <InlineError error={forecastQ.error} onRetry={() => forecastQ.refetch()} />
      ) : f ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Current rate"
            value={<AnimatedNumber value={f.current_rate} prefix="$" decimals={2} />}
            sub="per tonne"
            delay={0}
            isDemo={isDemo}
            icon={DollarSign}
          />
          <KpiCard
            label={`${sel.horizon}D forecast`}
            value={<AnimatedNumber value={f.predicted_rate} prefix="$" decimals={2} />}
            sub={f.model}
            tone="accent"
            delay={0.06}
            isDemo={isDemo}
            icon={TrendingUp}
          />
          <KpiCard
            label="Expected change"
            value={
              <span className={changeTone(f.expected_change_pct)}>
                <AnimatedNumber value={f.expected_change_pct} decimals={1} suffix="%" />
              </span>
            }
            sub={<TrendPill value={f.expected_change_pct} />}
            tone={f.expected_change_pct >= 0 ? "positive" : "negative"}
            delay={0.12}
            isDemo={isDemo}
            icon={Activity}
          />
          <KpiCard
            label="Confidence"
            value={<AnimatedNumber value={f.confidence} decimals={1} suffix="%" />}
            sub="model confidence"
            tone="positive"
            delay={0.18}
            isDemo={isDemo}
            icon={Gauge}
          />
        </div>
      ) : null}

      {/* Main forecast chart */}
      <div className="panel p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Freight rate outlook</h2>
            <p className="mt-0.5 text-xs text-ink-400">Historical rate + model forecast</p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((h) => (
              <button
                key={h}
                onClick={() => setSel({ ...sel, horizon: h })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  sel.horizon === h
                    ? "bg-accent-500/[0.12] text-accent-300"
                    : "text-ink-300 hover:bg-white/5 hover:text-ink-100"
                }`}
              >
                {h}D
              </button>
            ))}
          </div>
        </div>
        {forecastQ.isLoading ? (
          <SkeletonBlock className="h-[340px] w-full" />
        ) : forecastQ.isError ? (
          <InlineError error={forecastQ.error} onRetry={() => forecastQ.refetch()} />
        ) : f ? (
          <>
            <ForecastChart series={f.series} currentRate={f.current_rate} />
            {isDemo && (
              <p className="mt-3 text-center text-xs text-amber-300/80">
                Illustrative data — backend unavailable. Values shown are for demonstration only.
              </p>
            )}
          </>
        ) : null}
      </div>

      {/* Recommendation — the dominant takeaway on this screen */}
      <div className="panel-hero rule-accent-top overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="lg:max-w-sm">
            <div className="kicker">Recommendation</div>
            <div className="display mt-2 text-5xl text-white sm:text-6xl">
              {recommendation}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">
              {f?.reason ??
                "Recommendation is based on the live forecast and risk-adjusted procurement optimizer."}
            </p>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            <Stat
              label="Expected movement"
              value={fmtPct(f?.expected_change_pct ?? 2.2)}
              tone={changeTone(f?.expected_change_pct ?? 2.2)}
            />
            <Stat
              label="Confidence"
              value={`${(f?.confidence ?? 88).toFixed(1)}%`}
              tone="text-success-400"
            />
            <Stat label="Risk" value={recommendedOption?.risk ?? "—"} tone={risk.text} />
            <Stat
              label="Expected saving"
              value={o ? fmtInr(expectedSaving) : "—"}
              tone="text-success-400"
            />
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-ink-400">
            The model projects a modest upward drift within the forecast horizon. Locking now avoids
            exposure but forgoes a small modeled saving. Watch the 7-day signal before committing.
          </p>
          <button onClick={() => onNavigate("whatif")} className="btn-primary shrink-0">
            Run What-If Analysis
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cost comparison */}
      <div className="panel p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Cost comparison</h2>
            <p className="mt-0.5 text-xs text-ink-400">
              Risk-adjusted total cost across horizons
            </p>
          </div>
          {o?._demo && <DemoBadge />}
        </div>
        {optimizeQ.isLoading ? (
          <SkeletonBlock className="h-[260px] w-full" />
        ) : optimizeQ.isError ? (
          <InlineError error={optimizeQ.error} onRetry={() => optimizeQ.refetch()} />
        ) : o ? (
          <>
            <CostComparison
              options={o.options.map((opt) => ({
                label: opt.label,
                total: opt.total_cost,
                savings: opt.savings,
              }))}
              recommended={o.recommended}
            />
            <div className="mt-6">
              <CostBreakdownCards
                options={o.options.map((opt) => ({
                  label: opt.label,
                  total: opt.total_cost,
                  savings: opt.savings,
                }))}
                recommended={o.recommended}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="kicker">{label}</div>
      <div className={`num mt-1.5 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
