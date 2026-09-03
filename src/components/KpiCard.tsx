import { motion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
  delay = 0,
  isDemo = false,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning" | "accent";
  delay?: number;
  isDemo?: boolean;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const toneText = {
    neutral: "text-ink-100",
    positive: "text-success-400",
    negative: "text-danger-400",
    warning: "text-warn-400",
    accent: "text-accent-300",
  }[tone];

  const toneRule = {
    neutral: "bg-ink-500",
    positive: "bg-success-500",
    negative: "bg-danger-500",
    warning: "bg-warn-500",
    accent: "bg-accent-500",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="panel-interactive group relative overflow-hidden p-5"
    >
      <span className={`absolute inset-x-0 top-0 h-[2px] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100 ${toneRule}`} />
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 kicker">
          {Icon && <Icon className="h-3.5 w-3.5 text-ink-500" strokeWidth={1.75} />}
          {label}
        </span>
        {isDemo && (
          <span
            className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn-500"
            title="Illustrative data — backend unavailable"
          />
        )}
      </div>
      <div className={`display mt-3 text-[2.1rem] leading-none ${toneText}`}>{value}</div>
      {sub && <div className="mt-2.5 text-xs text-ink-400">{sub}</div>}
    </motion.div>
  );
}

export function TrendPill({ value }: { value: number }) {
  const up = value > 0;
  const flat = value === 0;
  const tone = flat ? "text-ink-400" : up ? "text-success-400" : "text-danger-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium num ${tone}`}>
      {!flat && (up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      {up ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}
