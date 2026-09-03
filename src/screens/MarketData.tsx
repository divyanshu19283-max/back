import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useSummary, useEda } from "@/lib/hooks";
import { DemoBadge, SkeletonBlock, InlineError } from "@/components/states";
import { fmtCompact, fmtUsd } from "@/lib/format";
import {
  Database,
  Calendar,
  Ship,
  MapPin,
  Layers,
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
} from "lucide-react";

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

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
          <span className="num font-semibold text-white">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MarketData() {
  const summaryQ = useSummary();
  const edaQ = useEda();
  const s = summaryQ.data;
  const e = edaQ.data;
  const isDemo = !!s?._demo || !!e?._demo;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Market Data</h1>
          {isDemo && <DemoBadge />}
        </div>
        <p className="text-sm text-slate-400">
          Prototype dataset · Historical + synthetic data. Not live market data.
        </p>
      </div>

      {/* Summary cards */}
      {summaryQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[96px]" />
          ))}
        </div>
      ) : summaryQ.isError ? (
        <InlineError onRetry={() => summaryQ.refetch()} />
      ) : s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={Database}
            label="Dataset size"
            value={fmtCompact(s.dataset_size)}
            sub={`${s.dataset_size.toLocaleString()} rows`}
          />
          <SummaryCard icon={Ship} label="Routes" value={String(s.routes)} sub="unique corridors" />
          <SummaryCard
            icon={Calendar}
            label="Date range"
            value={s.date_range.start.slice(0, 4)}
            sub={`${s.date_range.start} → ${s.date_range.end}`}
          />
          <SummaryCard
            icon={TrendingUp}
            label="Avg freight"
            value={fmtUsd(s.avg_freight_rate)}
            sub={`min ${fmtUsd(s.min_freight_rate)} · max ${fmtUsd(s.max_freight_rate)}`}
          />
        </div>
      ) : null}

      {/* Vessel + origins */}
      {s && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent-300" />
              <h2 className="text-base font-semibold text-white">Vessel Types</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.vessel_types.map((v) => (
                <span key={v} className="chip border-white/10 bg-white/[0.04] text-slate-300">
                  {v}
                </span>
              ))}
            </div>
          </div>
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent-300" />
              <h2 className="text-base font-semibold text-white">Origins</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {s.origins.map((o) => (
                <span key={o} className="chip border-white/10 bg-white/[0.04] text-slate-300">
                  {o}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {edaQ.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-[300px]" />
          ))}
        </div>
      ) : edaQ.isError ? (
        <InlineError onRetry={() => edaQ.refetch()} />
      ) : e ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Rate distribution */}
          {e.rate_distribution && (
            <ChartPanel
              icon={BarChart3}
              title="Rate Distribution"
              subtitle="Freight rate frequency by bin ($/t)"
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={e.rate_distribution}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="bin"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Route distribution */}
          {e.route_distribution && (
            <ChartPanel icon={Ship} title="Route Distribution" subtitle="Records per corridor">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={e.route_distribution}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="route"
                    tick={{ fill: "#94a3b8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={150}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="#22c55e"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Historical trend */}
          {e.historical_trend && (
            <ChartPanel
              icon={TrendingUp}
              title="Historical Trend"
              subtitle="Monthly average freight rate"
              wide
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={e.historical_trend}
                  margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={50}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Rate"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Vessel distribution pie */}
          {e.vessel_distribution && (
            <ChartPanel
              icon={PieIcon}
              title="Vessel Distribution"
              subtitle="Share of records by vessel class"
            >
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={e.vessel_distribution}
                    dataKey="count"
                    nameKey="vessel"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    isAnimationActive
                  >
                    {e.vessel_distribution.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        stroke="#0a0f1c"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                {e.vessel_distribution.map((v, i) => (
                  <span key={v.vessel} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {v.vessel}
                  </span>
                ))}
              </div>
            </ChartPanel>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-4"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        <span className="label-mono">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold text-white num">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </motion.div>
  );
}

function ChartPanel({
  icon: Icon,
  title,
  subtitle,
  children,
  wide = false,
}: {
  icon: typeof Database;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`panel p-5 ${wide ? "lg:col-span-2" : ""}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent-300" />
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}
