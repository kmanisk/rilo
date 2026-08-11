import { useState } from "preact/hooks";
import { DownloadItem } from "../types";
import {
  formatBytes,
  formatEta,
  getCategoryFromFilename,
} from "../utils";
import StatusBadge from "./StatusBadge";
import ContextMenu, { ContextMenuPosition } from "./ContextMenu";
import {
  Download,
  Plus,
  ArrowUpDown,
  FileText,
  Archive,
  Film,
  Music,
  Image as ImageIcon,
  Code,
  Package,
} from "lucide-preact";
import { Button } from "./ui/Button";
import DesktopProgressBar from "./ui/DesktopProgressBar";
import { isActiveDownload, normalizeDownloadStatus } from "../lib/downloads/status";

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
  onOpenDetailsWindow?: (item: DownloadItem) => void;
  onNewTask?: () => void;
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
  onOpenDetailsWindow,
  onNewTask,
}: DownloadGridProps) {
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    item: DownloadItem;
    position: ContextMenuPosition;
  } | null>(null);

  const [sortField, setSortField] = useState<"name" | "size" | "status" | "speed" | "eta" | "date">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: "name" | "size" | "status" | "speed" | "eta" | "date") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.filename.localeCompare(b.filename);
    } else if (sortField === "size") {
      comparison = (a.totalBytes || 0) - (b.totalBytes || 0);
    } else if (sortField === "status") {
      comparison = (a.status || "").localeCompare(b.status || "");
    } else if (sortField === "speed") {
      comparison = (a.speedBps || 0) - (b.speedBps || 0);
    } else if (sortField === "eta") {
      comparison = (a.etaSeconds || 999999) - (b.etaSeconds || 999999);
    } else {
      comparison = Number(a.startTime || a.createdAt || 0) - Number(b.startTime || b.createdAt || 0);
    }
    return sortDirection === "desc" ? -comparison : comparison;
  });

  const handleRowContextMenu = (e: MouseEvent, item: DownloadItem) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(item);
    setContextMenuTarget({
      item,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) return Archive;
    if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) return Film;
    if (["mp3", "flac", "wav", "aac", "ogg"].includes(ext)) return Music;
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon;
    if (["exe", "msi", "iso", "dmg"].includes(ext)) return Package;
    if (["js", "ts", "py", "rs", "json", "html", "css"].includes(ext)) return Code;
    return FileText;
  };

  const getCategoryLabel = (filename: string) => {
    const rawCat = getCategoryFromFilename(filename);
    return rawCat.replace("cat_", "");
  };

  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "—";
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  if (sortedItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-rilo-muted space-y-3 select-none py-16 font-sans">
        <div className="w-12 h-12 rounded-full bg-rilo-surface border border-rilo-border flex items-center justify-center text-rilo-accent">
          <Download className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-sm font-semibold text-rilo-primary">No downloads yet</h3>
          <p className="text-xs text-rilo-muted">Add a URL to start downloading files.</p>
        </div>
        {onNewTask && (
          <Button
            onClick={onNewTask}
            size="sm"
            className="bg-rilo-accent text-rilo-accent-foreground hover:bg-rilo-accent-hover font-semibold px-3 py-1.5 text-xs space-x-1"
          >
            <Plus className="w-4 h-4 font-bold" />
            <span>New Download</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="download-list w-full select-none font-sans">
      <div className="border border-rilo-border rounded-md bg-rilo-surface overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-rilo-border bg-rilo-elevated text-rilo-muted text-[11px] font-semibold">
              <th className="py-2 px-3 w-8 text-center">
                <input type="checkbox" className="rounded cursor-pointer" />
              </th>
              <th className="py-2 px-3 cursor-pointer hover:text-rilo-primary transition-colors" onClick={() => handleSort("name")}>
                <div className="flex items-center space-x-1">
                  <span>Name</span>
                  <ArrowUpDown className="w-3 h-3 text-rilo-muted" />
                </div>
              </th>
              <th className="py-2 px-3 w-28 text-right cursor-pointer hover:text-rilo-primary transition-colors" onClick={() => handleSort("size")}>
                <div className="flex items-center justify-end space-x-1">
                  <span>Size</span>
                  <ArrowUpDown className="w-3 h-3 text-rilo-muted" />
                </div>
              </th>
              <th className="py-2 px-3 w-28 cursor-pointer hover:text-rilo-primary transition-colors" onClick={() => handleSort("status")}>
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  <ArrowUpDown className="w-3 h-3 text-rilo-muted" />
                </div>
              </th>
              <th className="py-2 px-3 w-24 text-right cursor-pointer hover:text-rilo-primary transition-colors" onClick={() => handleSort("speed")}>
                <div className="flex items-center justify-end space-x-1">
                  <span>Speed</span>
                  <ArrowUpDown className="w-3 h-3 text-rilo-muted" />
                </div>
              </th>
              <th className="py-2 px-3 w-24 text-right cursor-pointer hover:text-rilo-primary transition-colors" onClick={() => handleSort("eta")}>
                <div className="flex items-center justify-end space-x-1">
                  <span>Time Left</span>
                  <ArrowUpDown className="w-3 h-3 text-rilo-muted" />
                </div>
              </th>
              <th className="py-2 px-3 w-28 cursor-pointer hover:text-rilo-primary transition-colors" onClick={() => handleSort("date")}>
                <div className="flex items-center space-x-1">
                  <span>Date Added</span>
                  <ArrowUpDown className="w-3 h-3 text-rilo-muted" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rilo-border/40 font-sans text-xs">
            {sortedItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              const statusLower = normalizeDownloadStatus(item.status);
              const isCompleted = statusLower === "completed";
              const isDownloading = isActiveDownload(statusLower);

              const FileIcon = getFileIcon(item.filename);
              const categoryLabel = getCategoryLabel(item.filename);

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item)}
                  onDblClick={() => {
                    if (isCompleted) {
                      onOpenFile(item.savePath);
                    } else if (onOpenDetailsWindow) {
                      onOpenDetailsWindow(item);
                    } else if (onOpenDetails) {
                      onOpenDetails(item);
                    }
                  }}
                  onContextMenu={(e) => handleRowContextMenu(e, item)}
                  className={`transition-colors cursor-pointer h-10 group ${
                    isSelected
                      ? "bg-rilo-selected text-rilo-primary"
                      : "hover:bg-rilo-elevated/70"
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="text-center px-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelect(item)}
                      className="rounded cursor-pointer"
                    />
                  </td>

                  {/* Icon + Filename + Subtitle Category */}
                  <td className="py-1 px-3 min-w-0">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <FileIcon className="w-4 h-4 text-rilo-accent flex-shrink-0" />
                      <div className="min-w-0 truncate">
                        <span className="font-semibold text-rilo-primary group-hover:text-rilo-accent transition-colors truncate block text-xs" title={item.filename}>
                          {item.filename}
                        </span>
                        <span className="text-[10px] text-rilo-muted capitalize block -mt-0.5">
                          {categoryLabel}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Total Size */}
                  <td className="py-1 px-3 text-right font-mono tabular-nums text-rilo-primary">
                    {item.totalBytes > 0 ? formatBytes(item.totalBytes) : formatBytes(item.bytesDownloaded)}
                  </td>

                  {/* Status Column */}
                  <td className="py-1 px-3">
                    {isCompleted ? (
                      <span className="font-semibold text-emerald-400">Finished</span>
                    ) : isDownloading ? (
                      <div className="flex flex-col space-y-0.5 min-w-[90px]">
                        <span className="font-semibold text-blue-400 text-[11px]">
                          {item.totalBytes > 0
                            ? `${Math.min(100, Math.floor((item.bytesDownloaded / item.totalBytes) * 100))}% Downloading`
                            : "Downloading"}
                        </span>
                        {item.totalBytes > 0 && (
                          <DesktopProgressBar
                            percent={(item.bytesDownloaded / item.totalBytes) * 100}
                            status={item.status}
                            heightClassName="h-2"
                            className="w-20 mt-0.5"
                          />
                        )}
                      </div>
                    ) : (
                      <span className="text-rilo-primary font-medium capitalize">
                        {item.status || "Added"}
                      </span>
                    )}
                  </td>

                  {/* Transfer Speed */}
                  <td className="py-1 px-3 text-right font-mono tabular-nums font-bold text-rilo-accent">
                    {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "—"}
                  </td>

                  {/* Time Remaining / ETA */}
                  <td className="py-1 px-3 text-right font-mono tabular-nums text-rilo-secondary">
                    {isDownloading && item.etaSeconds
                      ? formatEta(item.etaSeconds)
                      : isCompleted
                      ? "Finished"
                      : "—"}
                  </td>

                  {/* Date Added */}
                  <td className="py-1 px-3 text-rilo-muted font-mono text-[11px]">
                    {formatDate(item.startTime || item.createdAt)}
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
            if (onOpenDetailsWindow) onOpenDetailsWindow(item);
            else if (onOpenDetails) onOpenDetails(item);
          }}
        />
      )}
    </div>
  );
}
