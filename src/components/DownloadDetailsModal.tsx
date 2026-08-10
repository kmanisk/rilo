import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "../types";
import { formatBytes, formatEta, getDomainFromUrl, isArchiveFilename } from "../utils";
import UnifiedSegmentProgressBar from "./UnifiedSegmentProgressBar";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Checkbox } from "./ui/Checkbox";
import {
  X,
  FileText,
  Gauge,
  CalendarClock,
  Play,
  Pause,
  FolderOpen,
  FileCheck,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  Archive,
  Key,
  Loader2,
  AlertTriangle,
  HardDrive,
  Link as LinkIcon,
} from "lucide-preact";

interface DownloadDetailsModalProps {
  item: DownloadItem;
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

  const statusLower = (item.status || "").toLowerCase();
  const isDownloading = statusLower === "downloading" || statusLower === "reconnecting" || statusLower === "restarting";
  const isPaused = statusLower === "paused" || statusLower === "queued" || statusLower === "error" || statusLower === "failed" || statusLower === "cancelled";
  const isCompleted = statusLower === "completed";
  const domain = getDomainFromUrl(item.url);
  const remainingBytes = item.totalBytes > item.bytesDownloaded ? item.totalBytes - item.bytesDownloaded : 0;
  const percent = item.totalBytes > 0 ? Math.min(100, Math.round((item.bytesDownloaded / item.totalBytes) * 100)) : 0;

  const isArchive = isArchiveFilename(item.filename);
  const extState = item.extractionProgress?.state || item.extractionState || "Pending";
  const isExtracting = extState === "Extracting" || isExtractingLocal;
  const segments = item.segments || [];
  const threadCount = segments.length > 0 ? segments.length : item.activeThreads || 4;

  // Handle ESC key press to close modal
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
      await invoke("cancel_extraction", { downloadId: item.id });
    } catch (err) {
      console.error("Cancel extraction error:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-rilo-surface border border-rilo-border rounded-xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Window Titlebar */}
        <div className="bg-rilo-surface border-b border-rilo-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rilo-accent-muted border border-rilo-accent text-rilo-accent flex items-center justify-center flex-shrink-0 font-bold text-xs">
              R
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-rilo-primary uppercase tracking-wider">
                Rilo / Download Details
              </h2>
              <p className="text-[11px] text-rilo-muted font-mono truncate max-w-sm" title={item.filename}>
                {item.filename}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} title="Close Inspector (Esc)">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex border-b border-rilo-border bg-rilo-surface px-5 pt-2 space-x-1 text-xs">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-3 py-2 font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "info"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Info</span>
          </button>

          <button
            onClick={() => setActiveTab("speed")}
            className={`px-3 py-2 font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "speed"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Speed & Stats</span>
          </button>

          <button
            onClick={() => setActiveTab("completion")}
            className={`px-3 py-2 font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "completion"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>On Completion</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* TAB 1: INFO */}
          {activeTab === "info" && (
            <div className="space-y-4">
              {/* Primary Info Table */}
              <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3 space-y-2 font-mono text-[11px]">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Filename</span>
                    <span className="text-rilo-primary font-bold break-all">{item.filename}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Status</span>
                    <span className="text-rilo-accent font-bold capitalize">{item.status}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Total Size</span>
                    <span className="text-rilo-primary">{item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Downloaded</span>
                    <span className="text-rilo-primary">{formatBytes(item.bytesDownloaded)} ({percent}%)</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Current Speed</span>
                    <span className="text-rilo-accent font-bold tabular-nums">
                      {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "0 B/s"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Time Left</span>
                    <span className="text-rilo-primary tabular-nums">
                      {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? "Completed" : "-"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Resume Support</span>
                    <span className={item.resumable ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      {item.resumable ? "✓ Supported" : "✗ Unsupported"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-rilo-muted block font-sans">Source Domain</span>
                    <span className="text-rilo-accent truncate block" title={item.url}>{domain}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-rilo-border">
                  <span className="text-[10px] text-rilo-muted block font-sans">Destination Folder</span>
                  <span className="text-rilo-secondary break-all">{item.savePath}</span>
                </div>
              </div>

              {/* Archive Extraction Options (If Archive File) */}
              {isArchive && (
                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Archive className="w-4 h-4 text-rilo-accent" />
                      <span className="font-bold text-rilo-primary text-xs">Archive Extraction</span>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold capitalize ${
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
                    <div className="space-y-1.5 pt-1 border-t border-rilo-border">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-rilo-accent flex items-center space-x-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Decompressing entries...</span>
                        </span>
                        <span>{item.extractionProgress?.progress_percent.toFixed(0) || 0}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-rilo-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rilo-accent transition-all duration-300"
                          style={{ width: `${item.extractionProgress?.progress_percent || 0}%` }}
                        />
                      </div>
                      <Button variant="danger" size="sm" onClick={handleCancelExtraction} className="w-full text-[10px]">
                        Cancel Decompression
                      </Button>
                    </div>
                  )}

                  {showPasswordPrompt && !isExtracting && (
                    <div className="space-y-1.5 pt-1 border-t border-rilo-border">
                      <div className="flex items-center space-x-1 text-amber-400 text-[11px]">
                        <Key className="w-3.5 h-3.5" />
                        <span>Archive is password protected</span>
                      </div>
                      <Input
                        type="password"
                        placeholder="Enter password..."
                        value={password}
                        onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                        className="py-1 text-xs"
                      />
                      <Button variant="emerald" size="sm" onClick={() => handleManualExtract(password)} className="w-full text-[11px]">
                        Extract with Password
                      </Button>
                    </div>
                  )}

                  {isCompleted && !isExtracting && !showPasswordPrompt && (
                    <Button variant="emerald" size="sm" onClick={() => handleManualExtract()} className="w-full text-[11px] space-x-1">
                      <Archive className="w-3.5 h-3.5" />
                      <span>Extract Archive Now</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Collapsible SEGMENT CONNECTIONS Section */}
              <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3 space-y-2 select-none font-mono text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-rilo-accent" />
                    <span className="font-bold text-rilo-primary text-xs">SEGMENT CONNECTIONS</span>
                    <span className="bg-rilo-accent-muted text-rilo-accent px-1.5 py-0.2 rounded text-[10px] font-bold">
                      {threadCount} Parallel Threads
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSegments(!showSegments)}
                    className="flex items-center space-x-1 text-[11px] text-rilo-muted hover:text-rilo-primary transition-colors cursor-pointer"
                  >
                    <span>{showSegments ? "Hide Details ▲" : "Show Details ▼"}</span>
                  </button>
                </div>

                {/* Collapsible Segment Inspector Table */}
                {showSegments && (
                  <div className="space-y-2 pt-2 border-t border-rilo-border animate-in fade-in duration-150">
                    <UnifiedSegmentProgressBar
                      bytesDownloaded={item.bytesDownloaded}
                      totalBytes={item.totalBytes}
                      status={item.status}
                      segments={segments}
                      showSegments={true}
                      heightClassName="h-2.5"
                    />

                    <div className="max-h-52 overflow-y-auto custom-scrollbar border border-rilo-border/60 rounded bg-rilo-surface">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b border-rilo-border bg-rilo-elevated text-rilo-muted text-[9px] uppercase tracking-wider font-semibold">
                            <th className="py-1.5 px-2">#</th>
                            <th className="py-1.5 px-2">Status</th>
                            <th className="py-1.5 px-2">Downloaded</th>
                            <th className="py-1.5 px-2">Total</th>
                            <th className="py-1.5 px-2 text-right">Speed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rilo-border/40 font-mono">
                          {segments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-3 text-center text-rilo-muted font-sans text-[11px]">
                                Segment connections will populate when transfer begins ({threadCount} threads).
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
                                ? "✓ Completed"
                                : isSegRunning
                                ? "● Downloading"
                                : isSegPaused
                                ? "Ⅱ Paused"
                                : segStateLower === "connecting"
                                ? "○ Connecting"
                                : segStateLower === "retrying"
                                ? "↻ Retrying"
                                : "! Failed";

                              return (
                                <tr key={seg.segment_id} className="hover:bg-rilo-elevated/60 transition-colors">
                                  <td className="py-1 px-2 font-bold text-rilo-primary">{seg.segment_id}</td>
                                  <td className="py-1 px-2">
                                    <span
                                      className={`text-[9px] font-bold ${
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
                                  <td className="py-1 px-2 text-rilo-primary">{formatBytes(seg.downloaded_bytes)}</td>
                                  <td className="py-1 px-2 text-rilo-secondary">{formatBytes(seg.total_bytes)}</td>
                                  <td className="py-1 px-2 text-right tabular-nums font-bold text-rilo-accent">
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3">
                  <span className="text-[10px] text-rilo-muted block font-sans uppercase font-bold tracking-wider">Current Speed</span>
                  <span className="text-base font-extrabold text-rilo-accent tabular-nums">
                    {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : "0 B/s"}
                  </span>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3">
                  <span className="text-[10px] text-rilo-muted block font-sans uppercase font-bold tracking-wider">Peak Speed</span>
                  <span className="text-base font-extrabold text-emerald-400 tabular-nums">
                    {peakSpeedRef.current > 0 ? `${formatBytes(peakSpeedRef.current)}/s` : "0 B/s"}
                  </span>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3">
                  <span className="text-[10px] text-rilo-muted block font-sans uppercase font-bold tracking-wider">Downloaded</span>
                  <span className="text-sm font-bold text-rilo-primary tabular-nums">{formatBytes(item.bytesDownloaded)}</span>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3">
                  <span className="text-[10px] text-rilo-muted block font-sans uppercase font-bold tracking-wider">Remaining</span>
                  <span className="text-sm font-bold text-rilo-primary tabular-nums">{formatBytes(remainingBytes)}</span>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3">
                  <span className="text-[10px] text-rilo-muted block font-sans uppercase font-bold tracking-wider">ETA</span>
                  <span className="text-sm font-bold text-rilo-primary tabular-nums">
                    {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? "Finished" : "-"}
                  </span>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3">
                  <span className="text-[10px] text-rilo-muted block font-sans uppercase font-bold tracking-wider">Active Connections</span>
                  <span className="text-sm font-bold text-rilo-accent tabular-nums">{threadCount} threads</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ON COMPLETION */}
          {activeTab === "completion" && (
            <div className="space-y-4">
              <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-4 space-y-3.5">
                <div className="space-y-1.5">
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
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 flex items-start space-x-2.5 text-rose-400 animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1 text-[11px] font-sans leading-relaxed">
                      <span className="font-bold block text-rose-300">WARNING: Force Shutdown Enabled</span>
                      <p>
                        Force shutdown will close all open applications immediately when download completes, without allowing them to save unsaved work.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 pt-2 border-t border-rilo-border">
                  <span className="text-xs font-bold text-rilo-primary block">Completion Dialog Options</span>

                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-rilo-secondary">
                    <Checkbox
                      checked={showCompletionDialog}
                      onChange={(e) => setShowCompletionDialog((e.target as HTMLInputElement).checked)}
                    />
                    <span>Show completion dialog when download finishes</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-rilo-secondary">
                    <Checkbox
                      checked={autoOpenFile}
                      onChange={(e) => setAutoOpenFile((e.target as HTMLInputElement).checked)}
                    />
                    <span>Automatically open file on completion</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs text-rilo-secondary">
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

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 border-t border-rilo-border bg-rilo-surface flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            {isDownloading && (
              <Button variant="amber" size="sm" onClick={() => onPause(item.id)} className="space-x-1">
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </Button>
            )}

            {isPaused && (
              <Button variant="emerald" size="sm" onClick={() => onResume(item)} className="space-x-1">
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </Button>
            )}

            {isCompleted && (
              <>
                <Button variant="emerald" size="sm" onClick={() => onOpenFile(item.savePath)} className="space-x-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Open File</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenFolder(item.savePath)} className="space-x-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Folder</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {onDeleteFileDisk && (
              <Button variant="danger" size="sm" onClick={() => onDeleteFileDisk(item)} className="space-x-1">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete File</span>
              </Button>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
