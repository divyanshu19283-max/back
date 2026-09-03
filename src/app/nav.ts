import type { PageId } from "@/components/Sidebar";

/** Single source of truth mapping the in-app page ids used by the sidebar and
 * global search onto real router paths. */
export const PAGE_PATHS: Record<PageId, string> = {
  command: "/",
  maritime: "/maritime",
  forecast: "/forecast",
  charter: "/charter",
  whatif: "/what-if",
  optimize: "/optimization",
  market: "/market-data",
  model: "/model-intelligence",
  scenarios: "/scenarios",
};

export const PATH_PAGES: Record<string, PageId> = Object.fromEntries(
  Object.entries(PAGE_PATHS).map(([id, path]) => [path, id as PageId]),
) as Record<string, PageId>;
