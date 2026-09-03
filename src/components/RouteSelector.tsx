import { useEffect, useMemo } from "react";
import { useRoutes } from "@/lib/hooks";
import { Ship, MapPin, Calendar, Layers } from "lucide-react";
import { SkeletonBlock } from "./states";

export interface RouteSelection {
  origin: string;
  destination: string;
  vessel: string;
  horizon: number;
}

export function RouteSelector({
  value,
  onChange,
  compact = false,
}: {
  value: RouteSelection;
  onChange: (v: RouteSelection) => void;
  compact?: boolean;
}) {
  const { data, isLoading } = useRoutes();
  const routes = useMemo(() => data?.routes ?? [], [data]);
  const vesselTypes = useMemo(() => data?.vessel_types ?? [], [data]);
  const combinations = useMemo(() => data?.combinations ?? [], [data]);

  const norm = (v: string) => v.trim().toLowerCase();

  const destinations = useMemo(() => {
    const r = routes.find((x) => norm(x.origin) === norm(value.origin));
    return r?.destinations ?? [];
  }, [routes, value.origin]);

  // Filter vessels by the exact live route combination. The old selector
  // exposed every vessel globally, which allowed invalid combinations such
  // as a vessel that existed elsewhere in the dataset but not on this route.
  const validVessels = useMemo(() => {
    const exact = combinations
      .filter(
        (x) =>
          norm(x.origin) === norm(value.origin) && norm(x.destination) === norm(value.destination),
      )
      .map((x) => x.vessel_type);
    return exact.length ? Array.from(new Set(exact)) : vesselTypes;
  }, [combinations, vesselTypes, value.origin, value.destination]);

  // `routes` can change identity out from under an already-made selection:
  // useRoutes() first resolves to demo data (e.g. while the backend request
  // is in flight, or briefly on a transient error) and is then replaced by
  // the real backend list once it loads, or the other way around on a
  // reconnect. If the currently selected origin/destination/vessel isn't
  // part of whichever route list is loaded *now*, every dependent request
  // (forecast, optimize, etc.) will keep failing with "no historical data"
  // even though the dropdowns look populated. Snap back to a valid
  // combination whenever the loaded routes/vessels no longer contain the
  // current selection, instead of leaving the UI stuck on a stale choice.
  useEffect(() => {
    if (routes.length === 0) return;
    const currentRoute = routes.find((r) => norm(r.origin) === norm(value.origin));
    const originValid = !!currentRoute;
    const destinationValid = !!currentRoute?.destinations.some(
      (d) => norm(d) === norm(value.destination),
    );
    const vesselValid = validVessels.length === 0 || validVessels.includes(value.vessel);
    if (originValid && destinationValid && vesselValid) return;

    const fallbackRoute = currentRoute ?? routes[0];
    if (!fallbackRoute) return;
    const nextOrigin = fallbackRoute.origin;
    const nextDestination =
      destinationValid && currentRoute
        ? (currentRoute.destinations.find((d) => norm(d) === norm(value.destination)) ??
          currentRoute.destinations[0] ??
          "")
        : (fallbackRoute.destinations[0] ?? "");
    const nextVessel = vesselValid ? value.vessel : (validVessels[0] ?? value.vessel);

    if (
      nextOrigin !== value.origin ||
      nextDestination !== value.destination ||
      nextVessel !== value.vessel
    ) {
      onChange({ ...value, origin: nextOrigin, destination: nextDestination, vessel: nextVessel });
    }
  }, [routes, vesselTypes, validVessels, value, onChange]);

  const setField = (field: keyof RouteSelection, v: string | number) => {
    if (field === "origin") {
      const nextOrigin = String(v);
      const r = routes.find((x) => norm(x.origin) === norm(nextOrigin));
      const firstDest = r?.destinations[0] ?? "";
      const firstVessel =
        combinations.find(
          (x) => norm(x.origin) === norm(nextOrigin) && norm(x.destination) === norm(firstDest),
        )?.vessel_type ??
        vesselTypes[0] ??
        "";
      onChange({ ...value, origin: nextOrigin, destination: firstDest, vessel: firstVessel });
    } else if (field === "destination") {
      const nextDestination = String(v);
      const firstVessel =
        combinations.find(
          (x) =>
            norm(x.origin) === norm(value.origin) && norm(x.destination) === norm(nextDestination),
        )?.vessel_type ??
        validVessels[0] ??
        "";
      onChange({ ...value, destination: nextDestination, vessel: firstVessel });
    } else if (field === "vessel") {
      if (validVessels.some((x) => norm(x) === norm(String(v))))
        onChange({ ...value, vessel: String(v) });
    } else if (field === "horizon") {
      onChange({ ...value, horizon: Number(v) });
    }
  };

  const fields = [
    {
      icon: MapPin,
      label: "Origin",
      key: "origin" as const,
      options: routes.map((r) => r.origin),
    },
    {
      icon: Ship,
      label: "Destination",
      key: "destination" as const,
      options: destinations,
    },
    {
      icon: Layers,
      label: "Vessel",
      key: "vessel" as const,
      options: validVessels,
    },
  ];

  return (
    <div
      className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}
    >
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label className="label-mono flex items-center gap-1.5">
            <f.icon className="h-3 w-3" /> {f.label}
          </label>
          {isLoading ? (
            <SkeletonBlock className="h-[42px] w-full" />
          ) : (
            <select
              className="select"
              value={value[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
            >
              {f.options.length === 0 && <option value="">—</option>}
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
      <div className="space-y-1.5">
        <label className="label-mono flex items-center gap-1.5">
          <Calendar className="h-3 w-3" /> Horizon
        </label>
        <div className="flex rounded-lg border border-white/[0.07] bg-ink-800/70 p-0.5">
          {[7, 30, 90].map((h) => (
            <button
              key={h}
              onClick={() => onChange({ ...value, horizon: h })}
              className={`flex-1 rounded-md px-2 py-2 text-xs font-semibold transition ${
                value.horizon === h
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {h}D
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
