import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Compass,
  SlidersHorizontal,
  ListOrdered,
  Database,
  BrainCircuit,
  History,
  Anchor,
  ShipWheel,
  Search,
  X,
} from "lucide-react";
import { StatusStrip, type SystemStatus } from "./SystemStatus";

export type PageId =
  | "command"
  | "forecast"
  | "charter"
  | "whatif"
  | "optimize"
  | "market"
  | "model"
  | "scenarios"
  | "maritime";

export const NAV: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "command", label: "Command Center", icon: LayoutDashboard },
  { id: "maritime", label: "Maritime Operations", icon: ShipWheel },
  { id: "forecast", label: "Forecast", icon: TrendingUp },
  { id: "charter", label: "Charter Decision", icon: Compass },
  { id: "whatif", label: "What-If Simulator", icon: SlidersHorizontal },
  { id: "optimize", label: "Optimization", icon: ListOrdered },
  { id: "market", label: "Market Data", icon: Database },
  { id: "model", label: "Model Intelligence", icon: BrainCircuit },
  { id: "scenarios", label: "Scenarios", icon: History },
];

const NAV_GROUPS: { label: string; ids: PageId[] }[] = [
  { label: "Overview", ids: ["command", "maritime"] },
  { label: "Analysis", ids: ["forecast", "charter", "whatif", "optimize"] },
  { label: "Intelligence", ids: ["market", "model", "scenarios"] },
];

export function Sidebar({
  current,
  onNavigate,
  status,
  mobileOpen,
  onCloseMobile,
  onOpenSearch,
}: {
  current: PageId;
  onNavigate: (p: PageId) => void;
  status: SystemStatus;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed z-50 flex h-full w-[260px] flex-col border-r border-white/[0.06] bg-ink-950 transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent-500/25 bg-accent-500/[0.08]">
              <Anchor className="h-4 w-4 text-accent-400" strokeWidth={1.75} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-white">Freight</div>
              <div className="text-2xs text-ink-500">Intelligence · SIH 26006</div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-ink-300 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-4">
          <button
            onClick={onOpenSearch}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left text-sm text-ink-300 transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-ink-100"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1">Search…</span>
            <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-2xs text-ink-400">
              ⌘K
            </span>
          </button>
        </div>

        <div className="mx-5 divider" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-5" : ""}>
              <div className="mb-2 px-2 label-mono">{group.label}</div>
              <ul className="space-y-0.5">
                {group.ids.map((id, i) => {
                  const item = NAV.find((n) => n.id === id)!;
                  const active = current === item.id;
                  return (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: (gi * 4 + i) * 0.025, ease: [0.19, 1, 0.22, 1] }}
                    >
                      <button
                        onClick={() => {
                          onNavigate(item.id);
                          onCloseMobile();
                        }}
                        className={`group relative flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-[0.8125rem] transition-colors duration-150 ${
                          active
                            ? "bg-accent-500/[0.08] text-white"
                            : "text-ink-400 hover:bg-white/[0.03] hover:text-ink-200"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-accent-400"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        <item.icon
                          className={`h-[15px] w-[15px] shrink-0 transition-colors duration-150 ${active ? "text-accent-400" : "text-ink-500 group-hover:text-ink-300"}`}
                          strokeWidth={1.75}
                        />
                        <span>{item.label}</span>
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom status */}
        <div className="border-t border-white/[0.06] px-4 py-4">
          <div className="mb-3 flex flex-col gap-1.5">
            <StatusStrip status={status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-500">Version</span>
            <span className="font-mono text-2xs text-ink-300">{status.version}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
