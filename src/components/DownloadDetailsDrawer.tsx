import { useState } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "../types";
import { formatBytes, formatEta, getDomainFromUrl, isArchiveFilename } from "../utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import SegmentProgressView from "./SegmentProgressView";
import UnifiedSegmentProgressBar from "./UnifiedSegmentProgressBar";
import { X, FileText, Play, Pause, FolderOpen, RefreshCw, Trash2, FileCheck, Layers, Link as LinkIcon, HardDrive, Archive, Key, Loader2 } from "lucide-preact";

interface DownloadDetailsDrawerProps {
  item: DownloadItem;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onRemove: (id: string) => void;
  onDeleteFileDisk?: (item: DownloadItem) => void;
  onRefreshLink?: (item: DownloadItem) => void;
}

export default function DownloadDetailsDrawer({
  item,
  onClose,
  onOpenFile,
  onOpenFolder,
  onPause,
  onResume,
  onRemove,
  onDeleteFileDisk,
  onRefreshLink,
}: DownloadDetailsDrawerProps) {
  const [password, setPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isExtractingLocal, setIsExtractingLocal] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

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

  const handleToggleAutoExtract = async (val: boolean) => {
    try {
      await invoke("update_download_extraction_config", {
        downloadId: item.id,
        autoExtract: val,
        extractDir: item.extractDir || null,
        deleteAfter: item.deleteArchiveAfterExtract || false,
      });
    } catch (err) {
      console.error("Update config error:", err);
    }
  };

  const handleToggleDeleteAfter = async (val: boolean) => {
    try {
      await invoke("update_download_extraction_config", {
        downloadId: item.id,
        autoExtract: item.autoExtract || false,
        extractDir: item.extractDir || null,
        deleteAfter: val,
      });
    } catch (err) {
      console.error("Update config error:", err);
    }
  };

  return (
    <aside className="w-80 bg-rilo-surface border-l border-rilo-border flex flex-col justify-between h-full select-none text-xs flex-shrink-0 font-sans">
      {/* Drawer Header */}
      <div>
        <div className="p-3 border-b border-rilo-border flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rilo-accent" />
            <h2 className="font-bold text-rilo-primary truncate text-xs" title={item.filename}>
              {item.filename}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close details drawer (Esc)">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* File Details Section */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rilo-muted flex items-center space-x-1">
              <FileText className="w-3 h-3" />
              <span>File Details</span>
            </h3>
            <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5 space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-rilo-muted block text-[10px]">Filename</span>
                <span className="text-rilo-primary font-semibold break-all">{item.filename}</span>
              </div>

              <div>
                <span className="text-rilo-muted block text-[10px]">Destination Folder</span>
                <span className="text-rilo-secondary break-all">{item.savePath}</span>
              </div>

              <div>
                <span className="text-rilo-muted block text-[10px]">Source Domain</span>
                <span className="text-rilo-accent">{domain}</span>
              </div>
            </div>
          </div>

          {/* Archive Extraction Section */}
          {isArchive && (
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-rilo-muted flex items-center space-x-1">
                <Archive className="w-3 h-3 text-rilo-accent" />
                <span>Archive Extraction</span>
              </h3>
              <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-rilo-muted text-[10px]">Extraction State</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-bold capitalize ${
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

                <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-rilo-primary">
                  <input
                    type="checkbox"
                    checked={item.autoExtract || false}
                    onChange={(e) => handleToggleAutoExtract((e.target as HTMLInputElement).checked)}
                    className="rounded border-rilo-border text-rilo-accent focus:ring-rilo-accent"
                  />
                  <span>Auto-extract after download</span>
                </label>

                <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-rilo-muted">
                  <input
                    type="checkbox"
                    checked={item.deleteArchiveAfterExtract || false}
                    onChange={(e) => handleToggleDeleteAfter((e.target as HTMLInputElement).checked)}
                    className="rounded border-rilo-border text-rilo-accent focus:ring-rilo-accent"
                  />
                  <span>Delete archive after extraction</span>
                </label>

                {isExtracting && (
                  <div className="space-y-1.5 pt-1.5 border-t border-rilo-border">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-rilo-accent flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Extracting files...</span>
                      </span>
                      <span>{item.extractionProgress?.progress_percent.toFixed(0) || 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-rilo-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rilo-accent transition-all duration-300"
                        style={{ width: `${item.extractionProgress?.progress_percent || 0}%` }}
                      />
                    </div>
                    {item.extractionProgress?.current_file && (
                      <p className="text-[9px] text-rilo-muted truncate">
                        {item.extractionProgress.current_file}
                      </p>
                    )}
                    <Button variant="danger" size="sm" onClick={handleCancelExtraction} className="w-full text-[10px]">
                      Cancel Extraction
                    </Button>
                  </div>
                )}

                {extractError && !isExtracting && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded p-1.5 text-[10px] text-rose-400 break-words font-sans">
                    {extractError}
                  </div>
                )}

                {showPasswordPrompt && !isExtracting && (
                  <div className="space-y-1.5 pt-1.5 border-t border-rilo-border">
                    <div className="flex items-center space-x-1 text-amber-400 text-[10px]">
                      <Key className="w-3 h-3" />
                      <span>Archive is password protected</span>
                    </div>
                    <Input
                      type="password"
                      placeholder="Enter archive password..."
                      value={password}
                      onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                      className="py-1 text-[11px]"
                    />
                    <Button variant="emerald" size="sm" onClick={() => handleManualExtract(password)} className="w-full text-[10px]">
                      Extract with Password
                    </Button>
                  </div>
                )}

                {isCompleted && !isExtracting && !showPasswordPrompt && (
                  <Button variant="emerald" size="sm" onClick={() => handleManualExtract()} className="w-full text-[10px] space-x-1">
                    <Archive className="w-3.5 h-3.5" />
                    <span>Extract Archive Now</span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Segment & Connections Details */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rilo-muted flex items-center space-x-1">
              <Layers className="w-3 h-3" />
              <span>Segment Connections</span>
            </h3>
            <SegmentProgressView segments={item.segments} activeThreads={item.activeThreads} status={item.status} />
          </div>

          {/* Transfer Statistics */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rilo-muted flex items-center space-x-1">
              <HardDrive className="w-3 h-3" />
              <span>Transfer Statistics</span>
            </h3>
            <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2.5 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-rilo-muted">Progress</span>
                <span className="text-rilo-primary font-bold">{percent}%</span>
              </div>

              <UnifiedSegmentProgressBar
                bytesDownloaded={item.bytesDownloaded}
                totalBytes={item.totalBytes}
                status={item.status}
                segments={item.segments}
                heightClassName="h-2"
              />

              <div className="flex justify-between items-center text-[10px]">
                <span className="text-rilo-muted">Downloaded</span>
                <span className="text-rilo-primary">{formatBytes(item.bytesDownloaded)}</span>
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <span className="text-rilo-muted">Total Size</span>
                <span className="text-rilo-primary">{item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}</span>
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <span className="text-rilo-muted">Remaining</span>
                <span className="text-rilo-primary">{remainingBytes > 0 ? formatBytes(remainingBytes) : "0 B"}</span>
              </div>

              {isDownloading && (
                <>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-rilo-muted">Current Speed</span>
                    <span className="text-rilo-accent font-bold">{formatBytes(item.speedBps)}/s</span>
                  </div>
                  {item.etaSeconds && (
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-rilo-muted">Estimated Time</span>
                      <span className="text-rilo-primary">{formatEta(item.etaSeconds)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Full Source URL */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rilo-muted flex items-center space-x-1">
              <LinkIcon className="w-3 h-3" />
              <span>Download URL</span>
            </h3>
            <div className="bg-rilo-elevated border border-rilo-border rounded-md p-2 font-mono text-[10px] break-all text-rilo-secondary select-text">
              {item.url}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Action Footer */}
      <div className="p-3 border-t border-rilo-border bg-rilo-surface space-y-2">
        <div className="grid grid-cols-2 gap-2">
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

          {onRefreshLink && (isPaused || statusLower === "error") && (
            <Button variant="amber" size="sm" onClick={() => onRefreshLink(item)} className="space-x-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh URL</span>
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item.id)}
            className="flex-1 space-x-1 text-[11px]"
            title="Remove record from Rilo list only"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove from List</span>
          </Button>
          {onDeleteFileDisk && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDeleteFileDisk(item)}
              className="flex-1 space-x-1 text-[11px]"
              title="Permanently delete downloaded file from hard drive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete File</span>
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
