import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRecommendationsHistory, useScenariosHistory } from "@/lib/hooks";
import { DemoBadge, SkeletonRows, InlineError, EmptyState } from "@/components/states";
import { fmtInr, riskTone } from "@/lib/format";
import { Search, ArrowUpDown, History } from "lucide-react";

type SortKey = "date" | "route" | "vessel" | "action" | "confidence" | "risk" | "savings";

export function ScenarioHistory() {
  const recQ = useRecommendationsHistory();
  const sceQ = useScenariosHistory();

  const loading = recQ.isLoading || sceQ.isLoading;
  const error = recQ.isError || sceQ.isError;

  const rows = useMemo(() => {
    const recs = (recQ.data ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      route: `${r.origin} → ${r.destination}`,
      vessel: r.vessel,
      action: r.action,
      confidence: r.confidence,
      risk: r.risk,
      savings: r.savings,
    }));
    const sces = (sceQ.data ?? []).map((s) => ({
      id: 1000 + s.id,
      date: s.date,
      route: s.route,
      vessel: s.vessel,
      action: s.action,
      confidence: s.confidence,
      risk: s.risk,
      savings: s.savings,
    }));
    // merge + dedupe by date+route+vessel
    const seen = new Set<string>();
    return [...recs, ...sces]
      .filter((r) => {
        const k = `${r.date}-${r.route}-${r.vessel}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [recQ.data, sceQ.data]);

  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const actions = useMemo(() => ["ALL", ...Array.from(new Set(rows.map((r) => r.action)))], [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (r) =>
          r.route.toLowerCase().includes(q) ||
          r.vessel.toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q),
      );
    }
    if (actionFilter !== "ALL") out = out.filter((r) => r.action === actionFilter);
    out = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, query, actionFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const isDemo = (recQ.data?.length ?? 0) > 0 && (recQ.data?.[0]?.id ?? 999) <= 6;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Scenario History</h1>
          {isDemo && <DemoBadge />}
        </div>
        <p className="text-sm text-slate-400">Past recommendations and simulated scenarios.</p>
      </div>

      {/* Controls */}
      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search route, vessel, action…"
            className="input pl-9"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="select sm:w-48"
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "ALL" ? "All actions" : a}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <Th label="Date" k="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th
                  label="Route"
                  k="route"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Th
                  label="Vessel"
                  k="vessel"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Th
                  label="Action"
                  k="action"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Th
                  label="Confidence"
                  k="confidence"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  right
                />
                <Th label="Risk" k="risk" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th
                  label="Savings"
                  k="savings"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  right
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-5">
                    <SkeletonRows rows={6} cols={7} />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-5">
                    <InlineError
                      onRetry={() => {
                        recQ.refetch();
                        sceQ.refetch();
                      }}
                    />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState label="No scenarios match your filters" />
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const tone = riskTone(r.risk);
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.date}</td>
                      <td className="px-4 py-3 text-slate-200">{r.route}</td>
                      <td className="px-4 py-3">
                        <span className="chip border-white/10 bg-white/[0.04] text-slate-300">
                          {r.vessel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{r.action}</td>
                      <td className="px-4 py-3 text-right num text-slate-300">
                        {r.confidence.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={`chip ${tone.bg} ${tone.border} border ${tone.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} /> {r.risk}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right num font-semibold ${r.savings >= 0 ? "text-success-400" : "text-danger-400"}`}
                      >
                        {r.savings >= 0 ? "+" : "-"}
                        {fmtInr(Math.abs(r.savings))}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> {filtered.length} records
            </span>
            <span className="label-mono">Prototype dataset</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  right = false,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = sortKey === k;
  return (
    <th className={`px-4 py-3 ${right ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 label-mono transition ${active ? "text-accent-300" : "text-slate-500 hover:text-slate-300"}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {active && <span className="text-2xs">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
