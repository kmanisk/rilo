import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "../types";
import { formatBytes, formatEta, getDomainFromUrl, isArchiveFilename } from "../utils";
import UnifiedSegmentProgressBar from "./UnifiedSegmentProgressBar";
import DesktopProgressBar from "./ui/DesktopProgressBar";
import WindowChrome from "./window/WindowChrome";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Checkbox } from "./ui/Checkbox";
import {
  FileText,
  Gauge,
  CalendarClock,
  Play,
  Pause,
  FolderOpen,
  FileCheck,
  Square,
  Trash2,
  Layers,
  Archive,
  Key,
  Loader2,
  AlertTriangle,
  HardDrive,
  ChevronRight,
  ChevronDown,
} from "lucide-preact";
import { isActiveDownload, isResumableStatus, normalizeDownloadStatus } from "../lib/downloads/status";

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
  const [showSegments, setShowSegments] = useState(false);

  // Peak speed tracking per session
  const peakSpeedRef = useRef<number>(0);
  if (item.speedBps > peakSpeedRef.current) {
    peakSpeedRef.current = item.speedBps;
  }

  // Archive Extraction State
  const [password, setPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isExtractingLocal, setIsExtractingLocal] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

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

  const isArchive = isArchiveFilename(item.filename);
  const extState = item.extractionProgress?.state || item.extractionState || "Pending";
  const isExtracting = extState === "Extracting" || isExtractingLocal;
  const segments = item.segments || [];
  const threadCount = segments.length > 0 ? segments.length : item.activeThreads || 4;

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

  const handleManualExtract = async (pwdOverride?: string) => {
    try {
      setExtractError(null);
      setIsExtractingLocal(true);
      await invoke("extract_archive", {
        downloadId: item.id,
        archivePath: item.savePath,
        extractDir: item.extractDir || null,
        password: pwdOverride || password || null,
        deleteAfter: item.deleteArchiveAfterExtract || false,
      });
      setShowPasswordPrompt(false);
    } catch (err: any) {
      console.error("Extraction error:", err);
      const msg = err?.message || String(err);
      setExtractError(msg);
      if (msg.includes("password") || msg.includes("Password")) {
        setShowPasswordPrompt(true);
      }
    } finally {
      setIsExtractingLocal(false);
    }
  };

  const handleCancelExtraction = async () => {
    try {
      await invoke("cancel_extraction", { archivePath: item.savePath });
    } catch (err) {
      console.error("Cancel extraction error:", err);
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

  const content = (
    <div
      className={`bg-rilo-surface flex flex-col overflow-hidden select-none font-sans ${
        isStandaloneWindow
          ? "w-screen h-screen"
          : "border border-rilo-border rounded-md shadow-xl w-full max-w-xl max-h-[88vh]"
      }`}
    >
      {/* Reusable Frameless Window Chrome */}
      {isStandaloneWindow && (
        <WindowChrome
          title="Rilo"
          subtitle={`Download Details — ${item.filename}`}
          icon={HardDrive}
          showMaximize={true}
          onClose={onClose}
        />
      )}

      {/* 1. Compact Header Identity Row (Height ~48px) */}
      <div className="bg-rilo-surface border-b border-rilo-border px-3.5 py-2 flex items-center space-x-3 flex-shrink-0 h-[48px]">
        <div className="w-7 h-7 rounded bg-rilo-elevated border border-rilo-border text-rilo-accent flex items-center justify-center flex-shrink-0">
          <HardDrive className="w-4 h-4 text-rilo-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-rilo-primary truncate tracking-tight" title={item.filename}>
            {item.filename}
          </h1>
          <div className="flex items-center space-x-2 text-[11px] text-rilo-muted font-mono">
            <span className={`capitalize ${statusColorClass}`}>{item.status}</span>
            <span>•</span>
            <span>{item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown size"}</span>
            {isDownloading && item.speedBps > 0 && (
              <>
                <span>•</span>
                <span className="text-rilo-primary font-semibold tabular-nums">{formatBytes(item.speedBps)}/s</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Compact Tab Bar (Height ~38px) */}
      <div className="flex border-b border-rilo-border bg-rilo-surface px-3 space-x-1 text-xs h-[38px] flex-shrink-0 items-center">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`px-3 py-1 font-medium text-[12px] border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "info"
              ? "border-rilo-accent text-rilo-accent"
              : "border-transparent text-rilo-muted hover:text-rilo-primary"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("speed")}
          className={`px-3 py-1 font-medium text-[12px] border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "speed"
              ? "border-rilo-accent text-rilo-accent"
              : "border-transparent text-rilo-muted hover:text-rilo-primary"
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          <span>Speed & Stats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("completion")}
          className={`px-3 py-1 font-medium text-[12px] border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
            activeTab === "completion"
              ? "border-rilo-accent text-rilo-accent"
              : "border-transparent text-rilo-muted hover:text-rilo-primary"
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>On Completion</span>
        </button>
      </div>

      {/* 3. Main Body Content */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3 text-xs custom-scrollbar">
        {/* TAB 1: INFO */}
        {activeTab === "info" && (
          <div className="space-y-2.5">
            {/* Flat 2-Column Property List */}
            <div className="divide-y divide-rilo-border/40 font-mono text-xs">
              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Name</span>
                <span className="text-rilo-primary font-medium truncate text-right text-[12px]" title={item.filename}>
                  {item.filename}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Status</span>
                <span className={`capitalize text-[12px] ${statusColorClass}`}>{item.status}</span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Size</span>
                <span className="text-rilo-primary text-[12px]">
                  {item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Downloaded</span>
                <span className="text-rilo-primary text-[12px]">
                  {formatBytes(item.bytesDownloaded)} ({percent}%)
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Speed</span>
                <span className="text-rilo-accent font-semibold tabular-nums text-[12px]">
                  {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "0 B/s"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Time Left</span>
                <span className="text-rilo-primary tabular-nums text-[12px]">
                  {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? "Completed" : "-"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Resume Support</span>
                <span className={item.resumable ? "text-emerald-400 font-semibold text-[12px]" : "text-rose-400 font-semibold text-[12px]"}>
                  {item.resumable ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Source</span>
                <span className="text-rilo-accent truncate text-right text-[12px]" title={item.url}>
                  {domain}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 min-h-[28px]">
                <span className="text-rilo-muted text-[11px] font-sans w-28 flex-shrink-0">Save Path</span>
                <span className="text-rilo-secondary truncate text-right text-[11px]" title={item.savePath}>
                  {item.savePath}
                </span>
              </div>
            </div>

            {/* Active / Paused Download Progress Area */}
            {(isDownloading || isPaused) && (
              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-rilo-secondary">
                    {formatBytes(item.bytesDownloaded)} / {item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}
                  </span>
                  <span className="text-rilo-accent font-bold">{percent}%</span>
                </div>

                <DesktopProgressBar
                  percent={percent}
                  status={item.status}
                  heightClassName="h-2.5"
                />

                <div className="flex items-center justify-between text-[10px] text-rilo-muted">
                  <span>{isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : isPaused ? "Paused" : "Connecting..."}</span>
                  <span>{isDownloading && item.etaSeconds ? `${formatEta(item.etaSeconds)} left` : ""}</span>
                </div>
              </div>
            )}

            {/* Archive Extraction Section */}
            {isArchive && (
              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Archive className="w-4 h-4 text-rilo-accent" />
                    <span className="font-semibold text-rilo-primary text-xs">Archive Extraction</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold capitalize ${
                      extState === "Extracted"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : extState === "Extracting"
                        ? "bg-rilo-accent-muted text-rilo-accent border border-rilo-accent"
                        : extState === "ExtractionFailed"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        : "bg-rilo-surface text-rilo-secondary border border-rilo-border"
                    }`}
                  >
                    {extState}
                  </span>
                </div>

                {isExtracting && (
                  <div className="space-y-1 pt-1 border-t border-rilo-border">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-rilo-accent flex items-center space-x-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Decompressing...</span>
                      </span>
                      <span>{item.extractionProgress?.progress_percent.toFixed(0) || 0}%</span>
                    </div>
                    <DesktopProgressBar
                      percent={item.extractionProgress?.progress_percent || 0}
                      status="downloading"
                      heightClassName="h-2"
                    />
                    <Button variant="danger" size="sm" onClick={handleCancelExtraction} className="w-full text-[11px] h-7">
                      Cancel Decompression
                    </Button>
                  </div>
                )}

                {showPasswordPrompt && !isExtracting && (
                  <div className="space-y-1.5 pt-1 border-t border-rilo-border">
                    <div className="flex items-center space-x-1 text-amber-400 text-[11px]">
                      <Key className="w-3.5 h-3.5" />
                      <span>Archive password required</span>
                    </div>
                    <Input
                      type="password"
                      placeholder="Password..."
                      value={password}
                      onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                      className="py-1 text-xs"
                    />
                    <Button variant="emerald" size="sm" onClick={() => handleManualExtract(password)} className="w-full text-[11px] h-7">
                      Extract Archive
                    </Button>
                  </div>
                )}

                {isCompleted && !isExtracting && !showPasswordPrompt && (
                  <Button variant="emerald" size="sm" onClick={() => handleManualExtract()} className="w-full text-[11px] h-7 space-x-1">
                    <Archive className="w-3.5 h-3.5" />
                    <span>Extract Archive Now</span>
                  </Button>
                )}
              </div>
            )}

            {/* Segment Connections Section (Collapsed by Default) */}
            <div className="border border-rilo-border rounded-md bg-rilo-elevated/40 p-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowSegments(!showSegments)}
                className="w-full flex items-center justify-between text-left text-rilo-muted hover:text-rilo-primary transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-1.5">
                  {showSegments ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span className="text-[11px] font-sans font-medium">Connections</span>
                  <span className="text-[10px] text-rilo-accent font-semibold">• {threadCount} threads</span>
                </div>
                <span className="text-[10px]">{showSegments ? "Hide" : "Show Details"}</span>
              </button>

              {showSegments && (
                <div className="space-y-2 pt-2 mt-1.5 border-t border-rilo-border">
                  <UnifiedSegmentProgressBar
                    bytesDownloaded={item.bytesDownloaded}
                    totalBytes={item.totalBytes}
                    status={item.status}
                    segments={segments}
                    showSegments={true}
                    heightClassName="h-2"
                  />

                  <div className="max-h-36 overflow-y-auto custom-scrollbar border border-rilo-border/60 rounded bg-rilo-surface">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="border-b border-rilo-border bg-rilo-elevated text-rilo-muted text-[9px] uppercase tracking-wider font-semibold">
                          <th className="py-1 px-2">#</th>
                          <th className="py-1 px-2">Status</th>
                          <th className="py-1 px-2">Downloaded</th>
                          <th className="py-1 px-2">Total</th>
                          <th className="py-1 px-2 text-right">Speed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rilo-border/40 font-mono">
                        {segments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-2 text-center text-rilo-muted font-sans text-[11px]">
                              Connecting threads ({threadCount})...
                            </td>
                          </tr>
                        ) : (
                          segments.map((seg) => {
                            const segStateLower = (seg.state || "").toLowerCase();
                            const isSegComp = isCompleted || segStateLower === "completed";
                            const isSegPaused = isPaused || segStateLower === "paused";
                            const isSegRunning =
                              !isSegComp &&
                              !isSegPaused &&
                              (segStateLower === "running" || segStateLower === "downloading");

                            const statusSymbol = isSegComp
                              ? "✓ Done"
                              : isSegRunning
                              ? "● Active"
                              : isSegPaused
                              ? "Ⅱ Paused"
                              : "○ Wait";

                            return (
                              <tr key={seg.segment_id} className="hover:bg-rilo-elevated/60 transition-colors h-[24px]">
                                <td className="py-0.5 px-2 font-bold text-rilo-primary">{seg.segment_id}</td>
                                <td className="py-0.5 px-2">
                                  <span
                                    className={`text-[9px] font-semibold ${
                                      isSegComp
                                        ? "text-emerald-400"
                                        : isSegRunning
                                        ? "text-rilo-accent"
                                        : isSegPaused
                                        ? "text-amber-400"
                                        : "text-rilo-muted"
                                    }`}
                                  >
                                    {statusSymbol}
                                  </span>
                                </td>
                                <td className="py-0.5 px-2 text-rilo-primary">{formatBytes(seg.downloaded_bytes)}</td>
                                <td className="py-0.5 px-2 text-rilo-secondary">{formatBytes(seg.total_bytes)}</td>
                                <td className="py-0.5 px-2 text-right tabular-nums font-semibold text-rilo-accent">
                                  {isSegRunning && seg.current_speed_bps > 0
                                    ? `${formatBytes(seg.current_speed_bps)}/s`
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SPEED & STATS */}
        {activeTab === "speed" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5">
                <span className="text-[11px] text-rilo-muted block font-sans font-medium uppercase tracking-wider">Current Speed</span>
                <span className="text-xs font-bold text-rilo-accent tabular-nums">
                  {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "0 B/s"}
                </span>
              </div>

              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5">
                <span className="text-[11px] text-rilo-muted block font-sans font-medium uppercase tracking-wider">Peak Speed</span>
                <span className="text-xs font-bold text-emerald-400 tabular-nums">
                  {peakSpeedRef.current > 0 ? `${formatBytes(peakSpeedRef.current)}/s` : "0 B/s"}
                </span>
              </div>

              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5">
                <span className="text-[11px] text-rilo-muted block font-sans font-medium uppercase tracking-wider">Downloaded</span>
                <span className="text-xs font-semibold text-rilo-primary tabular-nums">{formatBytes(item.bytesDownloaded)}</span>
              </div>

              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5">
                <span className="text-[11px] text-rilo-muted block font-sans font-medium uppercase tracking-wider">Remaining</span>
                <span className="text-xs font-semibold text-rilo-primary tabular-nums">{formatBytes(remainingBytes)}</span>
              </div>

              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5">
                <span className="text-[11px] text-rilo-muted block font-sans font-medium uppercase tracking-wider">ETA</span>
                <span className="text-xs font-semibold text-rilo-primary tabular-nums">
                  {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? "Finished" : "-"}
                </span>
              </div>

              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5">
                <span className="text-[11px] text-rilo-muted block font-sans font-medium uppercase tracking-wider">Connections</span>
                <span className="text-xs font-semibold text-rilo-accent tabular-nums">{threadCount} threads</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ON COMPLETION */}
        {activeTab === "completion" && (
          <div className="space-y-3">
            <div className="bg-rilo-elevated border border-rilo-border rounded-md p-3 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-rilo-primary block">Post-Download Action</label>
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
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-md p-2.5 flex items-start space-x-2 text-rose-400 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px] font-sans leading-relaxed">
                    <span className="font-semibold block text-rose-300">WARNING: Force Shutdown Enabled</span>
                    <p>Applications will be forced to close immediately when completed.</p>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-rilo-border">
                <span className="text-xs font-semibold text-rilo-primary block">Completion Options</span>

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

      {/* 4. Compact Footer Command Bar (Height ~44px) */}
      <div className="px-3 py-2 border-t border-rilo-border bg-rilo-surface flex items-center justify-between h-[44px] flex-shrink-0">
        <div className="flex items-center space-x-1.5">
          {isDownloading && (
            <>
              <Button variant="amber" size="sm" onClick={() => onPause(item.id)} className="space-x-1 text-xs h-8">
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </Button>
              <Button variant="danger" size="sm" onClick={() => onRemove(item.id)} className="space-x-1 text-xs h-8">
                <Square className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button variant="emerald" size="sm" onClick={() => onResume(item)} className="space-x-1 text-xs h-8">
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </Button>
              <Button variant="danger" size="sm" onClick={() => onRemove(item.id)} className="space-x-1 text-xs h-8">
                <Square className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
            </>
          )}

          {isCompleted && (
            <>
              <Button variant="emerald" size="sm" onClick={() => onOpenFile(item.savePath)} className="space-x-1 text-xs h-8">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Open File</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenFolder(item.savePath)} className="space-x-1 text-xs h-8">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Folder</span>
              </Button>
            </>
          )}

          {!isDownloading && !isPaused && !isCompleted && (
            <>
              <Button variant="emerald" size="sm" onClick={() => onResume(item)} className="space-x-1 text-xs h-8">
                <Play className="w-3.5 h-3.5" />
                <span>Retry</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenFolder(item.savePath)} className="space-x-1 text-xs h-8">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Folder</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {onDeleteFileDisk && (
            <Button variant="danger" size="sm" onClick={() => onDeleteFileDisk(item)} className="space-x-1 text-xs h-8">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete File</span>
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs h-8">
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  if (isStandaloneWindow) {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {content}
    </div>
  );
}
