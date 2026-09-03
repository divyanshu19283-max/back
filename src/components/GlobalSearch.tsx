// Real, functional application-wide search — not a decorative input.
//
// Searches across:
//   - Pages (the sidebar nav)
//   - Live origin -> destination -> vessel route combinations, sourced
//     from /api/data/routes via useRoutes() (never demo/fake data — see
//     hooks.ts useRoutes for why)
//   - Discharge ports (/api/maritime/ports)
//   - Vessel types (/api/maritime/vessels)
//
// Selecting a result performs a real action: it navigates to the relevant
// page AND applies the selection (route selection, or origin+port), instead
// of just closing a dropdown.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Search, X, MapPin, Ship, Anchor, CornerDownLeft } from "lucide-react";
import { NAV, type PageId } from "./Sidebar";
import { useRoutes } from "@/lib/hooks";
import { api } from "@/lib/api";
import type { RouteSelection } from "./RouteSelector";

type ResultKind = "page" | "route" | "port" | "vessel";

interface SearchResult {
  id: string;
  kind: ResultKind;
  label: string;
  sublabel?: string;
  action: () => void;
}

export function GlobalSearch({
  open,
  onOpenChange,
  onNavigate,
  onSelectRoute,
  onSelectMaritime,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (p: PageId) => void;
  /** Merged into the current route selection — omit a field to leave it as-is. */
  onSelectRoute: (
    partial: Partial<Pick<RouteSelection, "origin" | "destination" | "vessel">>,
  ) => void;
  onSelectMaritime: (originId: string, portId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const routesQ = useRoutes();
  const portsQ = useQuery({
    queryKey: ["ports"],
    queryFn: () => api.listPorts(),
    retry: 0,
    staleTime: 300_000,
  });
  const vesselsQ = useQuery({
    queryKey: ["vessels"],
    queryFn: () => api.listVessels(),
    retry: 0,
    staleTime: 300_000,
  });
  const originsQ = useQuery({
    queryKey: ["origins"],
    queryFn: () => api.origins(),
    retry: 0,
    staleTime: 300_000,
  });

  // Global Ctrl/Cmd+K opens search from anywhere in the app.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Let the panel mount before focusing.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();

    const pageResults: SearchResult[] = NAV.filter(
      (item) => !q || item.label.toLowerCase().includes(q),
    ).map((item) => ({
      id: `page:${item.id}`,
      kind: "page",
      label: item.label,
      sublabel: "Page",
      action: () => onNavigate(item.id),
    }));

    const combos = routesQ.data?.combinations ?? [];
    const routeResults: SearchResult[] = combos
      .filter((c) => {
        if (!q) return false; // route combinations only show once the user types — there can be dozens
        const hay = `${c.origin} ${c.destination} ${c.vessel_type}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8)
      .map((c) => ({
        id: `route:${c.origin}|${c.destination}|${c.vessel_type}`,
        kind: "route",
        label: `${c.origin} → ${c.destination}`,
        sublabel: `${c.vessel_type} · route`,
        action: () =>
          onSelectRoute({ origin: c.origin, destination: c.destination, vessel: c.vessel_type }),
      }));

    const ports = portsQ.data ?? [];
    const origins = originsQ.data ?? [];
    const defaultOriginId = origins[0]?.id ?? "australia";
    const portResults: SearchResult[] = ports
      .filter((p) => !q || `${p.name} ${p.state}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: `port:${p.id}`,
        kind: "port",
        label: p.name,
        sublabel: `${p.state} · discharge port`,
        action: () => onSelectMaritime(defaultOriginId, p.id),
      }));

    const vessels = vesselsQ.data ?? [];
    const seenVesselTypes = new Set<string>();
    const vesselResults: SearchResult[] = vessels
      .filter((v) => !q || v.vessel_type.toLowerCase().includes(q))
      .filter((v) => {
        if (seenVesselTypes.has(v.vessel_type)) return false;
        seenVesselTypes.add(v.vessel_type);
        return true;
      })
      .slice(0, 6)
      .map((v) => ({
        id: `vessel:${v.id}`,
        kind: "vessel",
        label: v.vessel_type,
        // Only the vessel changes — origin/destination stay whatever they
        // currently are. If that vessel isn't valid for the current route,
        // RouteSelector's own reconciliation effect snaps it back to a
        // valid combination, so this can never leave an invalid selection.
        sublabel: `${v.dwt.toLocaleString()} DWT · vessel type`,
        action: () => onSelectRoute({ vessel: v.vessel_type }),
      }));

    return [...pageResults, ...routeResults, ...portResults, ...vesselResults];
  }, [
    query,
    routesQ.data,
    portsQ.data,
    vesselsQ.data,
    originsQ.data,
    onNavigate,
    onSelectRoute,
    onSelectMaritime,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results.length, query]);

  function runResult(r: SearchResult) {
    r.action();
    onOpenChange(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) runResult(r);
    }
  }

  if (!open) return null;

  const grouped: { title: string; kind: ResultKind }[] = [
    { title: "Pages", kind: "page" },
    { title: "Routes", kind: "route" },
    { title: "Ports", kind: "port" },
    { title: "Vessel Types", kind: "vessel" },
  ];

  let runningIndex = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm px-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, routes, ports, vessels…"
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close search"
            className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {query.trim()
                ? "No matches."
                : "Type to search routes, ports and vessels, or jump to a page."}
            </div>
          ) : (
            grouped.map((g) => {
              const items = results.filter((r) => r.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind} className="px-2 py-1">
                  <div className="px-2 py-1 text-xs font-medium text-slate-500">{g.title}</div>
                  {items.map((r) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={r.id}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => runResult(r)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "bg-accent-500/15 text-white"
                            : "text-slate-300 hover:bg-white/[0.04]"
                        }`}
                      >
                        <ResultIcon
                          kind={r.kind}
                          className={active ? "text-accent-300" : "text-slate-500"}
                        />
                        <span className="flex-1 truncate">{r.label}</span>
                        {r.sublabel && (
                          <span className="shrink-0 text-2xs text-slate-500">{r.sublabel}</span>
                        )}
                        {active && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-2xs text-slate-600">
          <span>↑↓ to navigate · Enter to select · Esc to close</span>
          <span className="font-mono">Ctrl/Cmd K</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ResultIcon({ kind, className = "" }: { kind: ResultKind; className?: string }) {
  const cls = `h-4 w-4 shrink-0 ${className}`;
  if (kind === "page") return <Search className={cls} />;
  if (kind === "route") return <MapPin className={cls} />;
  if (kind === "port") return <Anchor className={cls} />;
  return <Ship className={cls} />;
}
