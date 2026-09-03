import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
  LabelList,
} from "recharts";
import { fmtInrFull, fmtInr } from "@/lib/format";
import { Check } from "lucide-react";

export interface CostOption {
  label: string;
  total: number;
  freight_cost?: number;
  fuel_cost?: number;
  risk_adjustment?: number;
  savings?: number;
}

function CostTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CostOption }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-xs shadow-elevated">
      <div className="mb-1 font-semibold text-white">{p.label}</div>
      {p.freight_cost != null && (
        <div className="text-slate-400">
          Freight: <span className="num text-slate-200">{fmtInrFull(p.freight_cost)}</span>
        </div>
      )}
      {p.fuel_cost != null && (
        <div className="text-slate-400">
          Fuel: <span className="num text-slate-200">{fmtInrFull(p.fuel_cost)}</span>
        </div>
      )}
      {p.risk_adjustment != null && (
        <div className="text-slate-400">
          Risk adj: <span className="num text-slate-200">{fmtInrFull(p.risk_adjustment)}</span>
        </div>
      )}
      <div className="mt-1 border-t border-white/10 pt-1 text-slate-300">
        Total: <span className="num font-semibold text-white">{fmtInrFull(p.total)}</span>
      </div>
    </div>
  );
}

export function CostComparison({
  options,
  recommended,
  height = 260,
}: {
  options: CostOption[];
  recommended?: string;
  height?: number;
}) {
  const data = options.map((o) => ({ ...o, total: o.total }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "oklch(0.58 0.009 250)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip content={<CostTooltip />} cursor={{ fill: "oklch(1 0 0 / 0.03)" }} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} isAnimationActive>
          {data.map((d) => {
            const isBest =
              recommended === d.label ||
              (recommended === "CHARTER NOW" && d.label === "CHARTER NOW");
            return (
              <Cell
                key={d.label}
                fill={isBest ? "oklch(0.6 0.1 155)" : "oklch(0.31 0.009 250)"}
                stroke={isBest ? "oklch(0.68 0.1 155)" : "transparent"}
                strokeWidth={isBest ? 1 : 0}
              />
            );
          })}
          <LabelList
            dataKey="total"
            position="top"
            formatter={(v: unknown) => fmtInr(Number(v))}
            style={{ fill: "oklch(0.7 0.008 250)", fontSize: 10, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CostBreakdownCards({
  options,
  recommended,
}: {
  options: CostOption[];
  recommended?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {options.map((o, i) => {
        const isBest =
          recommended === o.label || (recommended === "CHARTER NOW" && o.label === "CHARTER NOW");
        const savings = o.savings ?? 0;
        const hasBreakdown =
          o.freight_cost != null && o.fuel_cost != null && o.risk_adjustment != null;
        return (
          <motion.div
            key={o.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className={`panel p-4 ${isBest ? "border-l-2 border-l-success-500" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="kicker">{o.label}</div>
              {isBest && (
                <span className="flex items-center gap-1 text-2xs font-medium text-success-400">
                  <Check className="h-3 w-3" /> Recommended
                </span>
              )}
            </div>
            <div className="mt-2 text-xl font-semibold text-white num">{fmtInr(o.total)}</div>
            <div className="mt-3 space-y-1.5 text-xs">
              {hasBreakdown && (
                <>
                  <Row label="Freight" value={fmtInrFull(o.freight_cost!)} />
                  <Row label="Fuel" value={fmtInrFull(o.fuel_cost!)} />
                  <Row label="Risk adj." value={fmtInrFull(o.risk_adjustment!)} />
                  <div className="my-1 divider" />
                </>
              )}
              <Row label="Total" value={fmtInrFull(o.total)} strong />
              <Row
                label="Savings"
                value={`${savings >= 0 ? "+" : "-"}${fmtInrFull(Math.abs(savings))}`}
                tone={savings >= 0 ? "pos" : "neg"}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "pos" | "neg";
}) {
  const c =
    tone === "pos"
      ? "text-success-400"
      : tone === "neg"
        ? "text-danger-400"
        : strong
          ? "text-white"
          : "text-slate-300";
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`num ${c} ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
