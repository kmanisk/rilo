import { useState } from "preact/hooks";
import { DownloadItem } from "../types";
import {
  formatBytes,
  formatEta,
  getDomainFromUrl,
  getFileIconLabel,
} from "../utils";
import StatusBadge from "./StatusBadge";
import UnifiedSegmentProgressBar from "./UnifiedSegmentProgressBar";
import ContextMenu, { ContextMenuPosition } from "./ContextMenu";
import { Layers } from "lucide-preact";

interface DownloadGridProps {
  items: DownloadItem[];
  selectedItem: DownloadItem | null;
  onSelect: (item: DownloadItem) => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onCancel: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRemove: (id: string) => void;
  onDeleteFileDisk: (item: DownloadItem) => void;
  onRefreshLink: (item: DownloadItem) => void;
  onOpenDetails?: (item: DownloadItem) => void;
}

export default function DownloadGrid({
  items,
  selectedItem,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onRemove,
  onDeleteFileDisk,
  onRefreshLink,
  onOpenDetails,
}: DownloadGridProps) {
  // Context Menu State
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    item: DownloadItem;
    position: ContextMenuPosition;
  } | null>(null);

  // Sort items continuously by creation/start timestamp (newest first)
  const sortedItems = [...items].sort((a, b) => Number(b.startTime || b.createdAt || 0) - Number(a.startTime || a.createdAt || 0));

  const handleRowContextMenu = (e: MouseEvent, item: DownloadItem) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(item);
    setContextMenuTarget({
      item,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  if (sortedItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-rilo-muted space-y-3 select-none py-20 font-sans">
        <div className="w-12 h-12 rounded-xl bg-rilo-surface border border-rilo-border flex items-center justify-center text-rilo-muted">
          <Layers className="w-6 h-6" />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-rilo-secondary">No downloads in this view</p>
          <p className="text-[11px] text-rilo-muted">Click "+ Add Task" or drag links to begin downloading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full select-none font-sans">
      {/* Continuous Desktop Download Table */}
      <div className="border border-rilo-border rounded-lg bg-rilo-surface overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-rilo-border bg-rilo-elevated text-rilo-muted text-[10px] uppercase font-bold tracking-wider font-mono">
              <th className="py-2 px-3 w-8 text-center">#</th>
              <th className="py-2 px-3">File Name & Source</th>
              <th className="py-2 px-3 w-28 text-right">Size</th>
              <th className="py-2 px-3 w-32">Status</th>
              <th className="py-2 px-3 w-28 text-right">Speed</th>
              <th className="py-2 px-3 w-24 text-right">ETA</th>
              <th className="py-2 px-3 w-36">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rilo-border/50 font-mono text-[11px]">
            {sortedItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const statusLower = (item.status || "").toLowerCase();
              const isCompleted = statusLower === "completed";
              const isDownloading =
                statusLower === "downloading" ||
                statusLower === "reconnecting" ||
                statusLower === "restarting";
              const percent =
                item.totalBytes > 0
                  ? Math.min(100, Math.round((item.bytesDownloaded / item.totalBytes) * 100))
                  : 0;
              const domain = getDomainFromUrl(item.url);
              const iconLabel = getFileIconLabel(item.filename);

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  onDblClick={() => {
                    if (isCompleted) {
                      onOpenFile(item.savePath);
                    } else if (onOpenDetails) {
                      onOpenDetails(item);
                    }
                  }}
                  onContextMenu={(e) => handleRowContextMenu(e, item)}
                  className={`transition-colors cursor-pointer group ${
                    isSelected
                      ? "bg-rilo-elevated text-rilo-primary ring-1 ring-rilo-accent/40"
                      : "hover:bg-rilo-elevated/60"
                  }`}
                >
                  {/* Category Icon */}
                  <td className="text-center" style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    <span className="w-5 h-5 rounded bg-rilo-elevated border border-rilo-border inline-flex items-center justify-center text-[9px] font-bold text-rilo-accent">
                      {iconLabel}
                    </span>
                  </td>

                  {/* Filename & Domain Source */}
                  <td className="min-w-0" style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    <div className="truncate font-sans font-semibold text-rilo-primary group-hover:text-rilo-accent transition-colors" title={item.filename}>
                      {item.filename}
                    </div>
                    <div className="text-[10px] text-rilo-muted truncate" title={item.url}>
                      {domain}
                    </div>
                  </td>

                  {/* Size */}
                  <td className="text-right tabular-nums text-rilo-secondary" style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    {formatBytes(item.bytesDownloaded)}
                    <span className="text-rilo-muted font-sans text-[10px]"> / </span>
                    <span className="text-rilo-primary">
                      {item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    <StatusBadge status={item.status} threads={item.activeThreads} />
                  </td>

                  {/* Speed */}
                  <td className="text-right tabular-nums font-bold text-rilo-accent" style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "—"}
                  </td>

                  {/* ETA */}
                  <td className="text-right tabular-nums text-rilo-secondary" style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    {isDownloading && item.etaSeconds
                      ? formatEta(item.etaSeconds)
                      : isCompleted
                      ? "Finished"
                      : "—"}
                  </td>

                  {/* Clean Progress Bar (% + Bar) */}
                  <td style={{ padding: "var(--download-card-padding, 8px 12px)" }}>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] tabular-nums">
                        <span className="font-bold text-rilo-primary">{percent}%</span>
                      </div>
                      <UnifiedSegmentProgressBar
                        bytesDownloaded={item.bytesDownloaded}
                        totalBytes={item.totalBytes}
                        status={item.status}
                        segments={item.segments}
                        showSegments={false}
                        heightClassName="h-1.5"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context Menu Overlay */}
      {contextMenuTarget && (
        <ContextMenu
          item={contextMenuTarget.item}
          position={contextMenuTarget.position}
          onClose={() => setContextMenuTarget(null)}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onRemove={onRemove}
          onDeleteFileDisk={onDeleteFileDisk}
          onRefreshLink={onRefreshLink}
          onOpenDetails={(item) => {
            if (onOpenDetails) onOpenDetails(item);
          }}
        />
      )}
    </div>
  );
}
