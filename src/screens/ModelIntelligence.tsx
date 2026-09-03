import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { useModelRuns } from "@/lib/hooks";
import { DEMO_MODEL_RUNS } from "@/lib/demo";
import { DemoBadge, SkeletonBlock, InlineError } from "@/components/states";
import { Brain, Trophy, Crown } from "lucide-react";
import type { ModelRun } from "@/lib/types";

const HORIZONS = [7, 30, 90];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-xs shadow-elevated">
      <div className="mb-1 font-mono text-2xs text-slate-500">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num font-semibold text-white">{p.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

export function ModelIntelligence() {
  const q = useModelRuns();
  const runs = useMemo(() => q.data ?? [], [q.data]);
  const isDemo = q.data === DEMO_MODEL_RUNS;

  const [horizon, setHorizon] = useState(7);
  const availableHorizons = useMemo(
    () => HORIZONS.filter((h) => runs.some((r) => r.horizon === h)),
    [runs],
  );
  const activeHorizon = availableHorizons.includes(horizon)
    ? horizon
    : (availableHorizons[0] ?? horizon);
  const [selectedMetric, setMetric] = useState<"mae" | "rmse" | "mape" | "r2">("mae");

  const forHorizon = useMemo(
    () => runs.filter((r) => r.horizon === activeHorizon),
    [runs, activeHorizon],
  );
  const sorted = useMemo(() => [...forHorizon].sort((a, b) => a.mae - b.mae), [forHorizon]);
  const winner = forHorizon.find((r) => r.is_best_model) ?? sorted[0];

  const chartData = sorted.map((r) => ({
    model: r.model,
    mae: r.mae,
    rmse: r.rmse,
    mape: r.mape,
    r2: r.r2,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Model Intelligence</h1>
          {isDemo && <DemoBadge />}
        </div>
        <p className="text-sm text-slate-400">Forecast model performance across horizons.</p>
      </div>

      {/* Horizon tabs */}
      <div className="flex gap-2">
        {HORIZONS.map((h) => (
          <button
            key={h}
            onClick={() => setHorizon(h)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              horizon === h
                ? "bg-white/[0.07] text-white"
                : "border border-white/[0.07] bg-white/[0.02] text-slate-400 hover:text-slate-200"
            }`}
          >
            {h}D
          </button>
        ))}
      </div>

      {/* Winner banner */}
      {winner && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel border-l-2 border-l-accent-500 p-5"
        >
          <div className="flex items-center gap-4">
            <Crown className="h-5 w-5 text-accent-400" strokeWidth={1.75} />
            <div>
              <div className="kicker">Winning model · {activeHorizon}D</div>
              <div className="text-xl font-semibold text-white">{winner.model}</div>
            </div>
            <div className="ml-auto flex gap-6">
              <WinnerStat label="MAE" value={winner.mae.toFixed(2)} />
              <WinnerStat label="RMSE" value={winner.rmse.toFixed(2)} />
              <WinnerStat label="MAPE" value={`${winner.mape.toFixed(2)}%`} />
              <WinnerStat label="R²" value={winner.r2.toFixed(3)} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Performance chart */}
      <div className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent-300" />
            <h2 className="text-base font-semibold text-white">Performance Comparison</h2>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1">
            {(["mae", "rmse", "mape", "r2"] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setMetric(metric)}
                className={`rounded-md px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider transition ${
                  metric === selectedMetric
                    ? "bg-white/[0.07] text-white"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {metric === "r2" ? "R²" : metric}
              </button>
            ))}
          </div>
        </div>
        {q.isLoading ? (
          <SkeletonBlock className="h-[300px] w-full" />
        ) : q.isError ? (
          <InlineError error={q.error} onRetry={() => q.refetch()} />
        ) : chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] text-sm text-slate-500">
            Model evaluation data is not available yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 18, left: 18, bottom: 4 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (selectedMetric === "mape" ? `${v}%` : v.toFixed(2))}
              />
              <YAxis
                type="category"
                dataKey="model"
                width={118}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar
                dataKey={selectedMetric}
                name={selectedMetric.toUpperCase()}
                radius={[0, 4, 4, 0]}
                isAnimationActive
              >
                {chartData.map((d) => (
                  <Cell key={d.model} fill={d.model === winner?.model ? "#3b82f6" : "#1c2942"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Leaderboard table */}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
          <Trophy className="h-4 w-4 text-accent-300" />
          <h2 className="text-base font-semibold text-white">
            Model Leaderboard · {activeHorizon}D
          </h2>
        </div>
        {q.isLoading ? (
          <div className="p-5">
            <SkeletonBlock className="h-[200px] w-full" />
          </div>
        ) : q.isError ? (
          <div className="p-5">
            <InlineError error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-5 py-3 label-mono">#</th>
                  <th className="px-5 py-3 label-mono">Model</th>
                  <th className="px-5 py-3 label-mono text-right">MAE</th>
                  <th className="px-5 py-3 label-mono text-right">RMSE</th>
                  <th className="px-5 py-3 label-mono text-right">MAPE</th>
                  <th className="px-5 py-3 label-mono text-right">R²</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const isWinner = i === 0;
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={`border-b border-white/[0.03] ${isWinner ? "bg-accent-500/[0.06]" : "hover:bg-white/[0.02]"}`}
                    >
                      <td className="px-5 py-3">
                        <span
                          className={`num font-mono font-semibold ${isWinner ? "text-accent-300" : "text-slate-500"}`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{r.model}</span>
                          {isWinner && <Crown className="h-3.5 w-3.5 text-accent-300" />}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right num text-slate-300">
                        {r.mae.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right num text-slate-300">
                        {r.rmse.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right num text-slate-300">
                        {r.mape.toFixed(2)}%
                      </td>
                      <td
                        className={`px-5 py-3 text-right num font-semibold ${isWinner ? "text-accent-300" : "text-slate-300"}`}
                      >
                        {r.r2.toFixed(3)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WinnerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="label-mono">{label}</div>
      <div className="num text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
