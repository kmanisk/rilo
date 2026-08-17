import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { DownloadItem } from "../types";
import { formatBytes, formatEta, getDomainFromUrl, isArchiveFilename } from "../utils";
import DesktopProgressBar from "./ui/DesktopProgressBar";
import WindowChrome from "./window/WindowChrome";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { Checkbox } from "./ui/Checkbox";
import {
  Play,
  Pause,
  Trash2,
  AlertTriangle,
  HardDrive,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Maximize2,
  Zap,
  Info,
  Archive,
  Film,
  Music,
  Image as ImageIcon,
  Package,
  Code,
  FileText,
  CalendarClock,
  Square
} from "lucide-preact";
import { isActiveDownload, isResumableStatus, normalizeDownloadStatus } from "../lib/downloads/status";

function getCategoryFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "img"].includes(ext)) return Archive;
  if (["mp4", "mkv", "avi", "mov", "webm", "flv"].includes(ext)) return Film;
  if (["mp3", "flac", "wav", "aac", "ogg", "m4a"].includes(ext)) return Music;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return ImageIcon;
  if (["exe", "msi", "dmg", "pkg", "apk", "bin"].includes(ext)) return Package;
  if (["js", "ts", "py", "rs", "json", "html", "css", "c", "cpp"].includes(ext)) return Code;
  return FileText;
}

interface DownloadDetailsModalProps {
  item: DownloadItem;
  isStandaloneWindow?: boolean;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onRemove: (id: string) => void;
  onDeleteFileDisk?: (item: DownloadItem) => void;
  onRefreshLink?: (item: DownloadItem) => void;
  onUpdateCompletionConfig?: (
    id: string,
    action: string,
    showDialog: boolean,
    openFile: boolean,
    openFolder: boolean
  ) => void;
}

export default function DownloadDetailsModal({
  item,
  isStandaloneWindow = false,
  onClose,
  onOpenFile,
  onOpenFolder,
  onPause,
  onResume,
  onRemove,
  onDeleteFileDisk,
  onRefreshLink,
  onUpdateCompletionConfig,
}: DownloadDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"info" | "speed" | "completion">("info");
  const [showSegments, setShowSegments] = useState(true);
  const [forceDetailedView, setForceDetailedView] = useState(false);

  // Peak speed tracking per session
  const peakSpeedRef = useRef<number>(0);
  if (item.speedBps > peakSpeedRef.current) {
    peakSpeedRef.current = item.speedBps;
  }

  // Post-Completion Configuration
  const [completionAction, setCompletionAction] = useState<string>("none");
  const [showCompletionDialog, setShowCompletionDialog] = useState<boolean>(true);
  const [autoOpenFile, setAutoOpenFile] = useState<boolean>(false);
  const [autoOpenFolder, setAutoOpenFolder] = useState<boolean>(false);

  const statusLower = normalizeDownloadStatus(item.status);
  const isDownloading = isActiveDownload(statusLower);
  const isPaused = isResumableStatus(statusLower);
  const isCompleted = statusLower === "completed";
  const isError = statusLower === "error" || statusLower === "cancelled";
  const domain = getDomainFromUrl(item.url);
  const remainingBytes = item.totalBytes > item.bytesDownloaded ? item.totalBytes - item.bytesDownloaded : 0;
  const percent = item.totalBytes > 0 ? Math.min(100, Math.round((item.bytesDownloaded / item.totalBytes) * 100)) : 0;

  const segments = item.segments || [];
  const threadCount = segments.length > 0 ? segments.length : item.activeThreads || 8;

  // Handle ESC key press to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCompletionActionChange = (action: string) => {
    setCompletionAction(action);
    if (onUpdateCompletionConfig) {
      onUpdateCompletionConfig(
        item.id,
        action,
        showCompletionDialog,
        autoOpenFile,
        autoOpenFolder
      );
    }
  };

  const statusColorClass = isCompleted
    ? "text-emerald-400 font-semibold"
    : isDownloading
    ? "text-rilo-accent font-semibold"
    : isPaused
    ? "text-amber-400 font-semibold"
    : isError
    ? "text-rose-400 font-semibold"
    : "text-rilo-secondary font-semibold";

  // Build synthetic segments if none provided but threads > 1
  const displaySegments = segments.length > 0 ? segments : Array.from({ length: threadCount }).map((_, idx) => {
    const partSize = Math.floor((item.totalBytes || 0) / threadCount);
    const start = idx * partSize;
    const end = idx === threadCount - 1 ? item.totalBytes : (idx + 1) * partSize;
    const downloaded = isCompleted ? (end - start) : Math.min(end - start, Math.floor((item.bytesDownloaded || 0) / threadCount));
    return {
      segment_id: idx + 1,
      start_byte: start,
      end_byte: end,
      downloaded_bytes: downloaded,
      total_bytes: end - start,
      progress_percent: end > start ? Math.min(100, Math.round((downloaded / (end - start)) * 100)) : 0,
      current_speed_bps: isDownloading ? Math.round((item.speedBps || 0) / threadCount) : 0,
      state: isCompleted ? "completed" : isDownloading ? "running" : isPaused ? "paused" : "pending",
    };
  });

  // =========================================================================
  // VIEW 1: COMPACT COMPLETED SUMMARY VIEW (Matching Reference Image 0)
  // =========================================================================
  if (isCompleted && !forceDetailedView) {
    const FileIcon = getCategoryFileIcon(item.filename);

    const completedContent = (
      <div
        className={`bg-rilo-surface flex flex-col justify-between overflow-hidden select-none font-sans text-rilo-primary ${
          isStandaloneWindow
            ? "w-screen h-screen"
            : "border border-rilo-border rounded-xl rilo-modal-shadow w-[420px] max-w-[95vw]"
        }`}
      >
        {/* Titlebar Header */}
        {isStandaloneWindow ? (
          <WindowChrome
            title={item.filename}
            icon={HardDrive}
            showMaximize={false}
            onClose={onClose}
          />
        ) : (
          <div className="bg-rilo-surface border-b border-rilo-border px-3 py-1.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-4 h-4 rounded bg-rilo-elevated border border-rilo-border text-rilo-accent flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-2.5 h-2.5 text-rilo-accent" />
              </div>
              <span className="text-xs font-semibold text-rilo-primary truncate tracking-tight" title={item.filename}>
                {item.filename}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors rounded cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Compact Summary Body */}
        <div className="px-4 py-3 flex items-center space-x-3.5 bg-rilo-surface flex-1">
          {/* Left: Category/File Icon + File Size underneath */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[64px]">
            <div className="w-8 h-8 rounded-lg bg-rilo-elevated border border-rilo-border flex items-center justify-center text-rilo-accent shadow-xs">
              <FileIcon className="w-4 h-4 text-rilo-accent" />
            </div>
            <span className="text-[11px] font-mono font-bold text-rilo-primary mt-1.5 text-center leading-tight">
              {item.totalBytes > 0 ? formatBytes(item.totalBytes) : formatBytes(item.bytesDownloaded)}
            </span>
          </div>

          {/* Right: Green Check + Download Completed heading + Filename on single line */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center space-x-1.5">
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <h2 className="text-xs font-bold text-emerald-400 tracking-wide">
                Download Completed
              </h2>
            </div>
            <div className="text-xs font-medium text-rilo-primary truncate select-text font-mono" title={item.filename}>
              {item.filename}
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="px-3.5 py-2.5 bg-rilo-surface border-t border-rilo-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenFile(item.savePath)}
              className="text-xs h-7 px-3.5 font-semibold"
            >
              Open
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenFolder(item.savePath)}
              className="text-xs h-7 px-3"
            >
              Open Folder
            </Button>

            <button
              type="button"
              onClick={async () => {
                setForceDetailedView(true);
                if (isStandaloneWindow) {
                  try {
                    const win = getCurrentWindow();
                    await win.setSize(new LogicalSize(560, 440));
                    await win.setResizable(true);
                  } catch (e) {}
                }
              }}
              className="w-7 h-7 rounded-md bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-surface flex items-center justify-center transition-all duration-100 cursor-pointer active:scale-95 shadow-xs"
              title="Show full technical properties & stats"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs h-7 px-3.5"
          >
            Close
          </Button>
        </div>
      </div>
    );

    if (isStandaloneWindow) {
      return completedContent;
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {completedContent}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: DETAILED INFO VIEW (Incomplete / Active / Paused / Stats)
  // =========================================================================
  const detailedContent = (
    <div
      className={`bg-rilo-surface flex flex-col overflow-hidden select-none font-sans text-rilo-primary ${
        isStandaloneWindow
          ? "w-screen h-screen"
          : "border border-rilo-border rounded-xl rilo-modal-shadow w-[560px] max-w-[95vw] max-h-[90vh]"
      }`}
    >
      {/* Reusable Frameless Window Chrome */}
      {isStandaloneWindow ? (
        <WindowChrome
          title="Rilo"
          subtitle={item.filename}
          icon={HardDrive}
          showMaximize={true}
          onClose={onClose}
        />
      ) : (
        <div className="bg-rilo-surface border-b border-rilo-border px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-5 h-5 rounded bg-rilo-elevated border border-rilo-border text-rilo-accent flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-3 h-3 text-rilo-accent" />
            </div>
            <span className="text-xs font-bold tracking-wide truncate" title={item.filename}>
              {item.filename}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isCompleted && (
              <button
                type="button"
                onClick={async () => {
                  setForceDetailedView(false);
                  if (isStandaloneWindow) {
                    try {
                      const win = getCurrentWindow();
                      await win.setSize(new LogicalSize(430, 160));
                      await win.setResizable(false);
                    } catch (e) {}
                  }
                }}
                className="text-[10px] text-rilo-accent hover:underline px-2 py-0.5"
              >
                Summary View
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors rounded cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation Bar */}
      <div className="flex border-b border-rilo-border bg-rilo-surface px-4 space-x-2 text-xs h-[36px] flex-shrink-0 items-center">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`h-6 px-2.5 rounded font-semibold text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "info"
              ? "bg-rilo-selected text-rilo-primary font-bold shadow-xs border border-rilo-border"
              : "text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated"
          }`}
        >
          <Info className="w-3 h-3 text-rilo-accent" />
          <span>Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("speed")}
          className={`h-6 px-2.5 rounded font-semibold text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "speed"
              ? "bg-rilo-selected text-rilo-primary font-bold shadow-xs border border-rilo-border"
              : "text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated"
          }`}
        >
          <Zap className="w-3 h-3 text-rilo-accent" />
          <span>Speed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("completion")}
          className={`h-6 px-2.5 rounded font-semibold text-xs transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "completion"
              ? "bg-rilo-selected text-rilo-primary font-bold shadow-xs border border-rilo-border"
              : "text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated"
          }`}
        >
          <CalendarClock className="w-3 h-3 text-rilo-accent" />
          <span>On Completion</span>
        </button>
      </div>

      {/* Main Body Content */}
      <div className="p-3.5 flex-1 overflow-y-auto space-y-3 text-xs custom-scrollbar bg-rilo-surface">
        {/* TAB 1: INFO */}
        {activeTab === "info" && (
          <div className="space-y-2.5">
            {/* Properties List */}
            <div className="border border-rilo-border rounded-lg bg-rilo-elevated/20 divide-y divide-rilo-border/60 font-mono text-xs px-3">
              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Name:</span>
                <span className="text-rilo-primary font-bold truncate text-right text-[11px]" title={item.filename}>
                  {item.filename}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Status:</span>
                <span className={`uppercase text-[11px] font-bold ${statusColorClass}`}>{item.status}</span>
              </div>

              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Size:</span>
                <span className="text-rilo-primary font-bold text-[11px]">
                  {item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Downloaded:</span>
                <span className="text-rilo-primary text-[11px]">
                  {formatBytes(item.bytesDownloaded)} {item.totalBytes > 0 ? `(${percent}%)` : ""}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Speed:</span>
                <span className="text-rilo-accent font-bold tabular-nums text-[11px]">
                  {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "0 B/s"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Time Left:</span>
                <span className="text-rilo-primary tabular-nums text-[11px]">
                  {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? "Completed" : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Resume Support:</span>
                <span className={item.resumable ? "text-emerald-400 font-bold text-[11px]" : "text-rilo-muted font-bold text-[11px]"}>
                  {item.resumable ? "Yes" : "Unknown"}
                </span>
              </div>

              {domain && (
                <div className="flex items-center justify-between py-1.5 min-h-[28px]">
                  <span className="text-rilo-muted text-[11px] font-sans w-32 flex-shrink-0">Source URL:</span>
                  <span className="text-rilo-accent truncate text-right text-[11px]" title={item.url}>
                    {domain}
                  </span>
                </div>
              )}
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1 pt-0.5">
              <DesktopProgressBar
                percent={percent}
                status={item.status}
                heightClassName="h-2.5"
              />
            </div>

            {/* Action Bar with Segment Toggle */}
            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => setShowSegments(!showSegments)}
                className="w-7 h-7 rounded-md bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-surface flex items-center justify-center transition-all duration-100 cursor-pointer active:scale-90 shadow-xs"
                title={showSegments ? "Hide connections table" : "Show connections table"}
              >
                {showSegments ? <ChevronUp className="w-3.5 h-3.5 text-rilo-accent" /> : <ChevronDown className="w-3.5 h-3.5 text-rilo-accent" />}
              </button>

              <div className="flex items-center space-x-2">
                {isDownloading ? (
                  <Button
                    type="button"
                    variant="amber"
                    size="sm"
                    onClick={() => onPause(item.id)}
                    className="space-x-1.5 text-xs h-7 px-3 font-semibold"
                  >
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="emerald"
                    size="sm"
                    onClick={() => onResume(item)}
                    className="space-x-1.5 text-xs h-7 px-3 font-semibold"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Resume</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onRemove(item.id)}
                  className="space-x-1.5 text-xs h-7 px-3"
                >
                  <Square className="w-3 h-3" />
                  <span>Cancel</span>
                </Button>
              </div>
            </div>

            {/* Collapsible Segment / Connection Table */}
            {showSegments && (
              <div className="border border-rilo-border/80 rounded-lg overflow-hidden bg-rilo-surface pt-0 animate-in fade-in duration-100">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-rilo-border bg-rilo-elevated text-rilo-muted text-[10px] uppercase tracking-wider font-bold">
                      <th className="py-1 px-2.5 w-8">#</th>
                      <th className="py-1 px-2.5">Status</th>
                      <th className="py-1 px-2.5">Downloaded</th>
                      <th className="py-1 px-2.5">Total</th>
                      <th className="py-1 px-2.5 text-right">Speed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rilo-border/40 font-mono">
                    {displaySegments.map((seg) => {
                      const segStateLower = (seg.state || "").toLowerCase();
                      const isSegComp = isCompleted || segStateLower === "completed";
                      const isSegPaused = isPaused || segStateLower === "paused";
                      const isSegRunning =
                        !isSegComp &&
                        !isSegPaused &&
                        (segStateLower === "running" || segStateLower === "downloading");

                      return (
                        <tr key={seg.segment_id} className="hover:bg-rilo-elevated/40 transition-colors h-[26px]">
                          <td className="py-0.5 px-2.5 font-bold text-rilo-primary">{seg.segment_id}</td>
                          <td className="py-0.5 px-2.5">
                            {isSegComp ? (
                              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Done</span>
                              </span>
                            ) : isSegRunning ? (
                              <span className="text-cyan-400 font-semibold flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>Active</span>
                              </span>
                            ) : isSegPaused ? (
                              <span className="text-amber-400 font-semibold flex items-center space-x-1">
                                <span>Ⅱ Paused</span>
                              </span>
                            ) : (
                              <span className="text-rilo-muted font-medium">Connecting</span>
                            )}
                          </td>
                          <td className="py-0.5 px-2.5 text-rilo-primary font-medium">{formatBytes(seg.downloaded_bytes)}</td>
                          <td className="py-0.5 px-2.5 text-rilo-secondary">{formatBytes(seg.total_bytes)}</td>
                          <td className="py-0.5 px-2.5 text-right tabular-nums font-bold text-rilo-accent">
                            {isSegRunning && seg.current_speed_bps > 0
                              ? `${formatBytes(seg.current_speed_bps)}/s`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SPEED & STATS */}
        {activeTab === "speed" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-2.5">
                <span className="text-[10px] text-rilo-muted block font-sans font-semibold uppercase tracking-wider">Current Speed</span>
                <span className="text-xs font-bold text-rilo-accent tabular-nums pt-0.5 block">
                  {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "0 B/s"}
                </span>
              </div>

              <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-2.5">
                <span className="text-[10px] text-rilo-muted block font-sans font-semibold uppercase tracking-wider">Peak Speed</span>
                <span className="text-xs font-bold text-emerald-400 tabular-nums pt-0.5 block">
                  {peakSpeedRef.current > 0 ? `${formatBytes(peakSpeedRef.current)}/s` : "0 B/s"}
                </span>
              </div>

              <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-2.5">
                <span className="text-[10px] text-rilo-muted block font-sans font-semibold uppercase tracking-wider">Downloaded</span>
                <span className="text-xs font-semibold text-rilo-primary tabular-nums pt-0.5 block">{formatBytes(item.bytesDownloaded)}</span>
              </div>

              <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-2.5">
                <span className="text-[10px] text-rilo-muted block font-sans font-semibold uppercase tracking-wider">Remaining</span>
                <span className="text-xs font-semibold text-rilo-primary tabular-nums pt-0.5 block">{formatBytes(remainingBytes)}</span>
              </div>

              <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-2.5">
                <span className="text-[10px] text-rilo-muted block font-sans font-semibold uppercase tracking-wider">ETA</span>
                <span className="text-xs font-semibold text-rilo-primary tabular-nums pt-0.5 block">
                  {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? "Finished" : "—"}
                </span>
              </div>

              <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-2.5">
                <span className="text-[10px] text-rilo-muted block font-sans font-semibold uppercase tracking-wider">Connections</span>
                <span className="text-xs font-semibold text-rilo-accent tabular-nums pt-0.5 block">{threadCount} threads</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ON COMPLETION */}
        {activeTab === "completion" && (
          <div className="space-y-2.5">
            <div className="bg-rilo-elevated/40 border border-rilo-border rounded-lg p-3 space-y-2.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-rilo-primary block">Post-Download Action</label>
                <Select
                  value={completionAction}
                  onChange={(e) => handleCompletionActionChange((e.target as HTMLSelectElement).value)}
                >
                  <option value="none">Do Nothing</option>
                  <option value="notify">Show Notification</option>
                  <option value="open_file">Open Downloaded File</option>
                  <option value="open_folder">Open Containing Folder</option>
                  <option value="sleep">Sleep System</option>
                  <option value="hibernate">Hibernate System</option>
                  <option value="shutdown">Shutdown System</option>
                  <option value="force_shutdown">Force Shutdown System</option>
                </Select>
              </div>

              {completionAction === "force_shutdown" && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 flex items-start space-x-2 text-rose-400 animate-in fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[10px] font-sans leading-relaxed">
                    <span className="font-bold block text-rose-300">WARNING: Force Shutdown Enabled</span>
                    <p>Applications will be forced to close immediately when completed.</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-1.5 border-t border-rilo-border/60">
                <span className="text-xs font-bold text-rilo-primary block">Completion Options</span>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-rilo-secondary">
                  <Checkbox
                    checked={showCompletionDialog}
                    onChange={(e) => setShowCompletionDialog((e.target as HTMLInputElement).checked)}
                  />
                  <span>Show completion dialog when download finishes</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-rilo-secondary">
                  <Checkbox
                    checked={autoOpenFile}
                    onChange={(e) => setAutoOpenFile((e.target as HTMLInputElement).checked)}
                  />
                  <span>Automatically open file on completion</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-xs text-rilo-secondary">
                  <Checkbox
                    checked={autoOpenFolder}
                    onChange={(e) => setAutoOpenFolder((e.target as HTMLInputElement).checked)}
                  />
                  <span>Automatically open folder on completion</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Footer */}
      <div className="px-3.5 py-2 border-t border-rilo-border bg-rilo-surface flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          {onDeleteFileDisk && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => onDeleteFileDisk(item)}
              className="space-x-1.5 text-xs h-7 px-3"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete File</span>
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="text-xs h-7 px-3.5"
        >
          Close
        </Button>
      </div>
    </div>
  );

  if (isStandaloneWindow) {
    return detailedContent;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {detailedContent}
    </div>
  );
}
