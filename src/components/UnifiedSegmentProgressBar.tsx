import { SegmentProgressPayload } from "../types";
import { formatBytes } from "../utils";
import { normalizeDownloadStatus } from "../lib/downloads/status";

interface UnifiedSegmentProgressBarProps {
  bytesDownloaded: number;
  totalBytes: number;
  status: string;
  segments?: SegmentProgressPayload[];
  showSegments?: boolean;
  heightClassName?: string;
  className?: string;
}

export default function UnifiedSegmentProgressBar({
  bytesDownloaded,
  totalBytes,
  status,
  segments,
  showSegments = false,
  heightClassName = "h-2.5",
  className = "",
}: UnifiedSegmentProgressBarProps) {
  const statusLower = normalizeDownloadStatus(status);
  const isCompleted = statusLower === "completed";
  const isPaused = statusLower === "paused";
  const isQueued = statusLower === "queued";
  const isError = statusLower === "error" || statusLower === "cancelled";

  // Overall percentage strictly based on total downloaded bytes / total file bytes
  const overallPercent =
    totalBytes > 0 ? Math.min(100, Math.max(0, (bytesDownloaded / totalBytes) * 100)) : 0;

  const segmentList = segments && segments.length > 0 ? segments : [];

  let overallStatusClass = "status-downloading";
  if (isCompleted) overallStatusClass = "status-completed";
  else if (isPaused) overallStatusClass = "status-paused";
  else if (isError) overallStatusClass = "status-error";
  else if (isQueued) overallStatusClass = "status-queued";

  // Segment Subdivisions View (Enabled in Details Window when requested)
  if (showSegments && segmentList.length > 1 && totalBytes > 0) {
    return (
      <div
        className={`w-full ${heightClassName} rilo-xp-progress-track flex relative select-none ${className}`}
        title={`Overall Progress: ${overallPercent.toFixed(1)}% (${formatBytes(bytesDownloaded)} / ${formatBytes(totalBytes)})`}
      >
        {segmentList.map((seg, idx) => {
          const segTotal = seg.total_bytes > 0 ? seg.total_bytes : totalBytes / segmentList.length;
          const segWidthPct = Math.max(0.1, (segTotal / totalBytes) * 100);

          const segDownloaded = seg.downloaded_bytes || (isCompleted ? segTotal : 0);
          const segProgressPct =
            segTotal > 0 ? Math.min(100, Math.max(0, (segDownloaded / segTotal) * 100)) : 0;

          const segStateLower = (seg.state || "").toLowerCase();
          let segStatusClass = overallStatusClass;
          if (segStateLower === "completed") segStatusClass = "status-completed";
          else if (segStateLower === "failed" || segStateLower === "error") segStatusClass = "status-error";
          else if (segStateLower === "paused") segStatusClass = "status-paused";

          const isLast = idx === segmentList.length - 1;

          return (
            <div
              key={seg.segment_id ?? idx}
              style={{ width: `${segWidthPct}%` }}
              className={`h-full bg-rilo-surface/60 relative overflow-hidden flex ${
                !isLast ? "border-r border-rilo-border/60" : ""
              }`}
              title={`Segment ${seg.segment_id}: ${formatBytes(segDownloaded)} / ${formatBytes(segTotal)} (${segProgressPct.toFixed(0)}%)`}
            >
              <div
                className={`rilo-xp-progress-fill ${segStatusClass}`}
                style={{ width: `${segProgressPct}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Standard Windows XP Desktop Progress Bar
  return (
    <div
      className={`w-full ${heightClassName} rilo-xp-progress-track ${className}`}
      title={`Overall Progress: ${overallPercent.toFixed(1)}% (${formatBytes(bytesDownloaded)} / ${formatBytes(totalBytes)})`}
    >
      <div
        className={`rilo-xp-progress-fill ${overallStatusClass}`}
        style={{ width: `${overallPercent}%` }}
      />
    </div>
  );
}
