import { formatBytes } from "../utils";

interface StatusBarProps {
  downloadingCount: number;
  totalSpeedBps: number;
  queuedCount: number;
  pausedCount: number;
}

export default function StatusBar({
  downloadingCount,
  totalSpeedBps,
  queuedCount,
  pausedCount,
}: StatusBarProps) {
  return (
    <footer className="bg-rilo-surface border-t border-rilo-border px-3 py-1 flex items-center justify-between text-xs font-mono text-rilo-secondary select-none flex-shrink-0">
      <div className="flex items-center space-x-2 tabular-nums">
        {downloadingCount > 0 ? (
          <>
            <span className="w-2 h-2 rounded-full bg-rilo-success animate-pulse" />
            <span className="text-rilo-primary font-semibold">{downloadingCount} downloading</span>
            <span className="text-rilo-muted">•</span>
            <span className="text-rilo-accent font-bold">{formatBytes(totalSpeedBps)}/s total</span>
            {queuedCount > 0 && (
              <>
                <span className="text-rilo-muted">•</span>
                <span className="text-rilo-secondary">{queuedCount} queued</span>
              </>
            )}
          </>
        ) : queuedCount > 0 ? (
          <>
            <span className="w-2 h-2 rounded-full bg-rilo-warning" />
            <span className="text-rilo-primary">{queuedCount} queued</span>
            {pausedCount > 0 && (
              <>
                <span className="text-rilo-muted">•</span>
                <span className="text-rilo-secondary">{pausedCount} paused</span>
              </>
            )}
          </>
        ) : (
          <span className="text-rilo-muted">No active downloads</span>
        )}
      </div>

      <div className="flex items-center space-x-3 text-[10px] text-rilo-muted font-sans">
        <span>Ready</span>
      </div>
    </footer>
  );
}
