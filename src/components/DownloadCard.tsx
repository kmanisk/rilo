import { DownloadItem } from "../types";
import { formatBytes, formatEta } from "../utils";
import StatusBadge from "./StatusBadge";
import UnifiedSegmentProgressBar from "./UnifiedSegmentProgressBar";

interface DownloadCardProps {
  item: DownloadItem;
  onSelect: (item: DownloadItem) => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onCancel: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRemove: (id: string) => void;
  onRefreshLink: (item: DownloadItem) => void;
}

export default function DownloadCard({
  item,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onRemove,
  onRefreshLink,
}: DownloadCardProps) {
  const percent =
    item.totalBytes > 0
      ? Math.min(100, Math.round((item.bytesDownloaded / item.totalBytes) * 100))
      : 0;

  const statusLower = (item.status || "").toLowerCase();
  const isCompleted = statusLower === "completed";
  const isDownloading = statusLower === "downloading" || statusLower === "reconnecting" || statusLower === "restarting";
  const isPaused = statusLower === "paused";
  const isQueued = statusLower === "queued";
  const isError = statusLower === "error" || statusLower === "failed" || statusLower === "cancelled";
  const canResume = isPaused || isQueued || isError;

  return (
    <div
      onClick={() => onSelect(item)}
      style={{ padding: "var(--download-card-padding, 12px 14px)" }}
      className={`border rounded-lg space-y-2.5 transition-all shadow-sm cursor-pointer group select-none ${
        isDownloading
          ? "bg-rilo-elevated border-rilo-accent hover:border-rilo-accent"
          : "bg-rilo-surface border-rilo-border hover:border-rilo-border hover:bg-rilo-elevated"
      }`}
    >
      {/* Top Row: File Icon, Filename, Speed, %, Status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded bg-rilo-elevated border border-rilo-border flex items-center justify-center text-rilo-accent flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-rilo-primary group-hover:text-rilo-accent truncate transition-colors" title={item.filename}>
              {item.filename}
            </h3>
            <p className="text-[10px] text-rilo-muted truncate font-mono" title={item.savePath}>
              {item.savePath}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {isDownloading && item.speedBps > 0 && (
            <span className="text-xs font-mono font-bold text-rilo-accent tabular-nums">
              {formatBytes(item.speedBps)}/s
            </span>
          )}

          <span className="text-xs font-mono font-extrabold text-rilo-primary min-w-[36px] text-right tabular-nums">
            {item.totalBytes > 0 ? `${percent}%` : isQueued ? "Queued" : "100%"}
          </span>

          <StatusBadge status={item.status} threads={item.activeThreads} />
        </div>
      </div>

      {/* Middle Section: Unified Segmented Progress Bar */}
      <UnifiedSegmentProgressBar
        bytesDownloaded={item.bytesDownloaded}
        totalBytes={item.totalBytes}
        status={item.status}
        segments={item.segments}
        heightClassName="h-2"
      />

      {/* Stats Metadata Row */}
      <div className="flex items-center justify-between text-[11px] font-mono text-rilo-secondary pt-0.5 tabular-nums">
        <div>
          <span>{formatBytes(item.bytesDownloaded)}</span>
          <span className="text-rilo-muted font-sans"> / </span>
          <span className="text-rilo-primary">{item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}</span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          {isDownloading && item.etaSeconds ? (
            <span>ETA: <strong className="text-rilo-primary tabular-nums">{formatEta(item.etaSeconds)}</strong></span>
          ) : null}

          <span>Threads: <strong className="text-rilo-accent">{item.activeThreads}</strong></span>

          <span className="hidden sm:inline">
            Range Support:{" "}
            <strong className={item.resumable ? "text-emerald-400" : "text-rose-400"}>
              {item.resumable ? "✓ Supported" : "✗ Unsupported"}
            </strong>
          </span>
        </div>
      </div>

      {/* Bottom Action Row */}
      <div className="flex items-center justify-end space-x-1.5 pt-1 border-t border-rilo-border" onClick={(e) => e.stopPropagation()}>
        {(isPaused || isError) && (
          <button
            onClick={() => onRefreshLink(item)}
            className="px-2 py-1 rounded bg-rilo-elevated hover:bg-amber-500/20 text-amber-400 border border-rilo-border text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
            title="Refresh Expired Link / Update URL"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Link</span>
          </button>
        )}

        {isDownloading && (
          <button
            onClick={() => onPause(item.id)}
            className="px-2.5 py-1 rounded bg-rilo-elevated hover:bg-amber-500/20 text-amber-400 border border-rilo-border text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1"
            title="Pause Download"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6" />
            </svg>
            <span>Pause</span>
          </button>
        )}

        {canResume && (
          <button
            onClick={() => onResume(item)}
            className="px-2.5 py-1 rounded bg-rilo-elevated hover:bg-emerald-500/20 text-emerald-400 border border-rilo-border text-[11px] font-semibold transition-colors cursor-pointer flex items-center space-x-1"
            title="Resume Download"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            <span>Resume</span>
          </button>
        )}

        {isCompleted && (
          <>
            <button
              onClick={() => onOpenFile(item.savePath)}
              className="px-2 py-1 rounded bg-rilo-elevated hover:bg-emerald-500/20 text-emerald-400 border border-rilo-border text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
              title="Open File"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <span>Open</span>
            </button>
            <button
              onClick={() => onOpenFolder(item.savePath)}
              className="px-2 py-1 rounded bg-rilo-elevated hover:bg-rilo-selected text-rilo-primary border border-rilo-border text-[11px] font-medium transition-colors cursor-pointer"
              title="Reveal Folder"
            >
              Folder
            </button>
          </>
        )}

        {(isDownloading || isPaused || isQueued) && (
          <button
            onClick={() => onCancel(item.id)}
            className="p-1.5 rounded bg-rilo-elevated hover:bg-rose-500/20 text-rose-400 border border-rilo-border transition-colors cursor-pointer"
            title="Cancel Task"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 rounded bg-rilo-elevated hover:bg-rilo-selected text-rilo-secondary hover:text-rilo-primary border border-rilo-border transition-colors cursor-pointer"
          title="Remove Record"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
