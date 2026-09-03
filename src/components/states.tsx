import { WifiOff, RefreshCw } from "lucide-react";

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-2xs font-medium text-warn-400 ${className}`}
      title="Illustrative data — backend unavailable"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warn-500" />
      Demo mode
    </span>
  );
}

export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-2xs font-medium text-success-400 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
      Live
    </span>
  );
}

export function ErrorState({
  title = "Backend temporarily unavailable",
  message = "Your interface is still available.",
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex ${compact ? "flex-row items-center gap-3 p-3" : "flex-col items-center justify-center gap-2 p-8 text-center"} rounded-md border border-warn-500/25 bg-warn-500/[0.04]`}
    >
      <div className="flex items-center gap-2 text-warn-400">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-ink-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-1 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function InlineError({ onRetry, error }: { onRetry?: () => void; error?: unknown }) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Something went wrong while processing this request.";
  return (
    <div className="flex items-center gap-2 rounded-md border border-danger-500/25 bg-danger-500/[0.04] px-3 py-2 text-xs text-danger-400">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto text-danger-400 hover:text-danger-300 underline-offset-2 hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ label = "No data yet" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-ink-500">
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock
              key={c}
              className={`h-3 ${c === 0 ? "w-20" : c === cols - 1 ? "w-16" : "w-24"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
