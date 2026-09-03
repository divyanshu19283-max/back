import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface FlowStep {
  label: string;
  value?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent";
  done?: boolean;
}

const toneText: Record<NonNullable<FlowStep["tone"]>, string> = {
  neutral: "text-ink-200",
  positive: "text-success-400",
  negative: "text-danger-400",
  accent: "text-accent-300",
};

/** The evidentiary pipeline behind every recommendation on this desk:
 * Market → Evidence → Forecast → Risk → Recommended Action. Shown as a
 * single dense terminal-style strip rather than five separate cards, so
 * the causal chain reads as one instrument, not a grid of widgets. */
export function FlowStrip({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="flex items-stretch overflow-x-auto border border-white/[0.07] bg-ink-900 no-scrollbar">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-stretch">
          <div className="flex min-w-[132px] flex-col justify-center gap-1 px-4 py-3">
            <span className="label-mono flex items-center gap-1.5">
              <span
                className={`h-1 w-1 rounded-full ${s.done === false ? "bg-ink-600" : "bg-accent-500"}`}
              />
              {s.label}
            </span>
            <span className={`num text-sm font-medium ${toneText[s.tone ?? "neutral"]}`}>
              {s.value ?? "—"}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center border-l border-white/[0.06] bg-ink-950/40 px-1">
              <ChevronRight className="h-3.5 w-3.5 text-ink-600" strokeWidth={1.5} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
