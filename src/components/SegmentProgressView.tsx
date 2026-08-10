import { useState } from "preact/hooks";
import { SegmentProgressPayload } from "../types";
import { formatBytes } from "../utils";
import UnifiedSegmentProgressBar from "./UnifiedSegmentProgressBar";
import { ChevronDown, ChevronRight, Layers } from "lucide-preact";

interface SegmentProgressViewProps {
  segments?: SegmentProgressPayload[];
  activeThreads: number;
  status?: string;
  bytesDownloaded?: number;
  totalBytes?: number;
}

export default function SegmentProgressView({
  segments,
  activeThreads,
  status,
  bytesDownloaded = 0,
  totalBytes = 0,
}: SegmentProgressViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const segmentList = segments || [];
  const count = segmentList.length > 0 ? segmentList.length : activeThreads;
  const statusLower = (status || "").toLowerCase();

  const isQueued = statusLower === "queued" || statusLower === "pending";
  const isPaused = statusLower === "paused";
  const isCompleted = statusLower === "completed";

  // Calculate bytesDownloaded from segments if not passed explicitly
  const computedDownloaded =
    bytesDownloaded > 0
      ? bytesDownloaded
      : segmentList.reduce((acc, s) => acc + (s.downloaded_bytes || 0), 0);

  const computedTotal =
    totalBytes > 0
      ? totalBytes
      : segmentList.reduce((acc, s) => acc + (s.total_bytes || 0), 0);

  return (
    <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-2.5 space-y-2.5 font-mono text-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-rilo-accent" />
          <span className="font-semibold text-xs text-rilo-primary">Segment Connections</span>
          <span className="bg-rilo-accent-muted text-rilo-accent px-1.5 py-0.2 rounded text-[10px] font-bold">
            {count} Threads
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1 text-[11px] text-rilo-muted hover:text-rilo-primary transition-colors cursor-pointer"
        >
          <span>{isExpanded ? "Hide Details" : "Segment Range Details"}</span>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Unified Single Progress Bar */}
      <UnifiedSegmentProgressBar
        bytesDownloaded={computedDownloaded}
        totalBytes={computedTotal}
        status={status || "downloading"}
        segments={segmentList}
        heightClassName="h-2.5"
      />

      {/* Technical Segment Byte-Range Details Table (When Expanded) */}
      {isExpanded && (
        <div className="space-y-1 pt-2 border-t border-rilo-border max-h-52 overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
          {segmentList.length === 0 || isQueued ? (
            <p className="text-[11px] text-rilo-muted text-center py-2 font-sans">
              Segment breakdown will appear when transfer starts ({count} threads configured).
            </p>
          ) : (
            <div className="space-y-1">
              {segmentList.map((seg) => {
                const segStateLower = (seg.state || "").toLowerCase();
                const isSegmentComp = isCompleted || segStateLower === "completed";
                const isSegmentPaused = isPaused || segStateLower === "paused";
                const isSegmentRunning =
                  !isSegmentComp &&
                  !isSegmentPaused &&
                  (segStateLower === "running" || segStateLower === "downloading");

                return (
                  <div
                    key={seg.segment_id}
                    className="bg-rilo-surface border border-rilo-border/60 rounded px-2 py-1 flex items-center justify-between text-[10px] font-mono"
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <span className="font-bold text-rilo-primary">Seg #{seg.segment_id}</span>
                      <span className="text-rilo-muted truncate">
                        {formatBytes(seg.start_byte)} – {formatBytes(seg.end_byte)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0 tabular-nums">
                      {isSegmentRunning && seg.current_speed_bps > 0 ? (
                        <span className="text-rilo-accent font-bold">{formatBytes(seg.current_speed_bps)}/s</span>
                      ) : (
                        <span className="text-rilo-muted">—</span>
                      )}
                      <span className="font-bold text-rilo-primary min-w-[32px] text-right">
                        {seg.progress_percent.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
