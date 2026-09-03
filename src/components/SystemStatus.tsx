import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type SystemStatus = {
  api: "online" | "offline" | "checking";
  database: "connected" | "unknown";
  ml: "ready" | "unknown";
  version: string;
};

export function useSystemStatus(): SystemStatus {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    refetchInterval: 20000,
    retry: 0,
    staleTime: 10000,
  });

  if (q.isLoading) {
    return { api: "checking", database: "unknown", ml: "unknown", version: "v1.0" };
  }
  if (q.isError || !q.data) {
    return { api: "offline", database: "unknown", ml: "unknown", version: "v1.0" };
  }
  const h = q.data;
  return {
    api: "online",
    database: h.database === "connected" || h.database === "ok" ? "connected" : "unknown",
    ml: h.model_loaded ? "ready" : "unknown",
    version: h.version ?? "v1.0",
  };
}

export function StatusDot({
  state,
}: {
  state: "online" | "connected" | "ready" | "offline" | "unknown" | "checking";
}) {
  const map = {
    online: "bg-success-500",
    connected: "bg-success-500",
    ready: "bg-success-500",
    offline: "bg-danger-500",
    unknown: "bg-ink-600",
    checking: "bg-warn-500 animate-pulse",
  } as const;
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[state]}`} />;
}

export function StatusStrip({ status }: { status: SystemStatus }) {
  const items = [
    { label: "API", state: status.api, okText: "Online", badText: "Offline" },
    { label: "Database", state: status.database, okText: "Connected", badText: "Unknown" },
    { label: "ML engine", state: status.ml, okText: "Ready", badText: "Unknown" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => {
        const ok = it.state === "online" || it.state === "connected" || it.state === "ready";
        return (
          <div key={it.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusDot state={it.state} />
              <span className="text-xs text-ink-400">{it.label}</span>
            </div>
            <span className={`text-2xs num ${ok ? "text-success-400" : "text-ink-500"}`}>
              {ok ? it.okText : it.badText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StatusBanner({ status }: { status: SystemStatus }) {
  if (status.api !== "offline") return null;
  return (
    <div className="flex items-center gap-2 border-b border-warn-500/20 bg-warn-500/[0.05] px-4 py-2 text-xs text-warn-400">
      <span>Backend unavailable — interface running in demo mode.</span>
    </div>
  );
}

export function MiniStatus({ status }: { status: SystemStatus }) {
  const ok = status.api === "online";
  return (
    <div className="flex items-center gap-2">
      <StatusDot state={status.api} />
      <span className={`text-2xs font-medium ${ok ? "text-success-400" : "text-ink-500"}`}>
        {ok ? "All systems nominal" : "Demo mode"}
      </span>
    </div>
  );
}
