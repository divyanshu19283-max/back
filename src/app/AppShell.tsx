import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Anchor, Search } from "lucide-react";
import { Sidebar, type PageId } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import type { RouteSelection } from "@/components/RouteSelector";
import { useSystemStatus, StatusBanner } from "@/components/SystemStatus";
import { PAGE_PATHS, PATH_PAGES } from "./nav";

const DEFAULT_SELECTION: RouteSelection = {
  origin: "Australia",
  destination: "East Coast India",
  vessel: "Panamax",
  horizon: 30,
};

type SelectionContextValue = {
  sel: RouteSelection;
  setSel: (next: RouteSelection) => void;
  maritimeOriginId: string | undefined;
  maritimePortId: string | undefined;
  setMaritimeOriginId: (id: string | undefined) => void;
  setMaritimePortId: (id: string | undefined) => void;
  goto: (page: PageId) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

/** Shared origin/destination/vessel/horizon selection. Picking a route on any
 * screen (or through global search) carries across every other screen. */
export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside <AppShell />");
  return ctx;
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [sel, setSel] = useState<RouteSelection>(DEFAULT_SELECTION);
  const [maritimeOriginId, setMaritimeOriginId] = useState<string | undefined>(undefined);
  const [maritimePortId, setMaritimePortId] = useState<string | undefined>(undefined);

  const goto = useMemo(
    () => (page: PageId) => {
      void navigate({ to: PAGE_PATHS[page] ?? "/" });
    },
    [navigate],
  );

  const value = useMemo<SelectionContextValue>(
    () => ({
      sel,
      setSel,
      maritimeOriginId,
      maritimePortId,
      setMaritimeOriginId,
      setMaritimePortId,
      goto,
    }),
    [sel, maritimeOriginId, maritimePortId, goto],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current: PageId = PATH_PAGES[pathname] ?? "command";
  const { sel, setSel, goto, setMaritimeOriginId, setMaritimePortId } = useSelection();

  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const status = useSystemStatus();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNav(false);
  }, [pathname]);

  function handleSelectRoute(
    partial: Partial<Pick<RouteSelection, "origin" | "destination" | "vessel">>,
  ) {
    setSel({ ...sel, ...partial });
    if (!["command", "forecast", "charter", "optimize"].includes(current)) goto("forecast");
  }

  function handleSelectMaritime(originId: string, portId: string) {
    setMaritimeOriginId(originId);
    setMaritimePortId(portId);
    goto("maritime");
  }

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="bg-ambient" aria-hidden="true" />
      <StatusBanner status={status} />
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={goto}
        onSelectRoute={handleSelectRoute}
        onSelectMaritime={handleSelectMaritime}
      />
      <div className="relative z-[1] flex">
        <Sidebar
          current={current}
          onNavigate={goto}
          status={status}
          mobileOpen={mobileNav}
          onCloseMobile={() => setMobileNav(false)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main className="flex min-h-screen w-full min-w-0 flex-col lg:pl-[260px]">
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-ink-950/90 backdrop-blur px-3 py-3 sm:px-4 lg:hidden">
            <button
              onClick={() => setMobileNav(true)}
              className="rounded-md p-2 text-ink-300 transition hover:bg-white/5 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Anchor className="h-4 w-4 text-accent-400" strokeWidth={1.75} />
              <span className="text-sm font-semibold tracking-tight text-white">Freight</span>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-md p-2 text-ink-300 transition hover:bg-white/5 hover:text-white"
              aria-label="Open search"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
          <div className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <div className="mx-auto min-w-0 max-w-[1400px]">{children}</div>
          </div>
          <footer className="px-4 py-6 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-[1400px]">
              <div className="divider mb-5" />
              <p className="text-2xs leading-relaxed text-ink-500">
                Intelligent Freight Forecasting &amp; Chartering Decision Support · SIH 2026 PS
                26006. All forecasting, optimization and voyage economics are computed locally by
                the bundled FastAPI + scikit-learn/XGBoost/LightGBM service — no external or paid
                APIs are used. Data that is synthetic or assumed is labelled as such wherever it
                appears.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export function PageWrapper({ children }: { children: ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
