// Formatting helpers shared across the app.

export const fmtUsd = (n: number, dp = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const fmtInr = (n: number) => {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

export const fmtInrFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const fmtPct = (n: number, dp = 1) => `${n > 0 ? "+" : ""}${n.toFixed(dp)}%`;

export const fmtNum = (n: number, dp = 1) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const riskTone = (risk: string) => {
  const r = risk.toUpperCase();
  if (r.includes("LOW"))
    return {
      text: "text-success-400",
      bg: "bg-success-500/10",
      border: "border-success-500/30",
      dot: "bg-success-500",
    };
  if (r.includes("HIGH"))
    return {
      text: "text-danger-400",
      bg: "bg-danger-500/10",
      border: "border-danger-500/30",
      dot: "bg-danger-500",
    };
  return {
    text: "text-warn-400",
    bg: "bg-warn-500/10",
    border: "border-warn-500/30",
    dot: "bg-warn-500",
  };
};

export const changeTone = (n: number) =>
  n > 0 ? "text-success-400" : n < 0 ? "text-danger-400" : "text-slate-400";
