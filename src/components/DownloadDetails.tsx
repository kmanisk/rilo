import { useState } from "preact/hooks";
import { DownloadItem } from "../types";
import { formatBytes, formatEta } from "../utils";
import { Button } from "./ui/Button";
import SegmentProgressView from "./SegmentProgressView";
import { X, Info, Activity, Settings, FileCheck, FolderOpen, Play, Pause, RefreshCw, Trash2, HardDrive } from "lucide-preact";

interface DownloadDetailsProps {
  item: DownloadItem;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onRemove: (id: string) => void;
  onDeleteFileDisk?: (item: DownloadItem) => void;
  onRefreshLink: (item: DownloadItem) => void;
}

export default function DownloadDetails({
  item,
  onClose,
  onOpenFile,
  onOpenFolder,
  onPause,
  onResume,
  onRemove,
  onDeleteFileDisk,
  onRefreshLink,
}: DownloadDetailsProps) {
  const [activeTab, setActiveTab] = useState<"info" | "segments" | "speed" | "advanced">("info");

  const statusLower = (item.status || "").toLowerCase();
  const isDownloading = statusLower === "downloading" || statusLower === "reconnecting";
  const isPaused = statusLower === "paused" || statusLower === "queued" || statusLower === "error";
  const isCompleted = statusLower === "completed";
  const remainingBytes = Math.max(0, item.totalBytes - item.bytesDownloaded);
  const percent = item.totalBytes > 0 ? Math.min(100, Math.round((item.bytesDownloaded / item.totalBytes) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-rilo-surface border-b border-rilo-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded bg-rilo-accent-muted border border-rilo-accent flex items-center justify-center text-rilo-accent">
              <Info className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-rilo-primary truncate max-w-md">
              {item.filename}
            </h3>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-rilo-border bg-rilo-surface px-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === "info"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>General Info</span>
          </button>

          <button
            onClick={() => setActiveTab("segments")}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === "segments"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Segments & Threads</span>
          </button>

          <button
            onClick={() => setActiveTab("speed")}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === "speed"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Transfer Speed</span>
          </button>

          <button
            onClick={() => setActiveTab("advanced")}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === "advanced"
                ? "border-rilo-accent text-rilo-accent"
                : "border-transparent text-rilo-secondary hover:text-rilo-primary"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Metadata</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono flex-1">
          {activeTab === "info" && (
            <div className="space-y-3">
              <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg space-y-2">
                <div>
                  <span className="text-rilo-muted block text-[10px]">Source URL</span>
                  <span className="text-rilo-secondary select-text break-all text-[11px]">{item.url}</span>
                </div>

                <div>
                  <span className="text-rilo-muted block text-[10px]">Destination Folder</span>
                  <span className="text-rilo-primary break-all text-[11px]">{item.savePath}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg">
                  <span className="text-rilo-muted block text-[10px]">Status State</span>
                  <span className="text-rilo-accent font-bold capitalize text-sm">{item.status}</span>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg">
                  <span className="text-rilo-muted block text-[10px]">Progress</span>
                  <span className="text-rilo-primary font-bold text-sm">{percent}%</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "segments" && (
            <div className="space-y-3">
              <SegmentProgressView segments={item.segments} activeThreads={item.activeThreads} status={item.status} />
            </div>
          )}

          {activeTab === "speed" && (
            <div className="space-y-3">
              <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-rilo-muted">Downloaded Bytes</span>
                  <span className="text-rilo-primary font-bold">{formatBytes(item.bytesDownloaded)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-rilo-muted">Total File Size</span>
                  <span className="text-rilo-primary">{item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Unknown"}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-rilo-muted">Remaining Bytes</span>
                  <span className="text-rilo-primary">{formatBytes(remainingBytes)}</span>
                </div>

                {isDownloading && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-rilo-muted">Current Transfer Speed</span>
                      <span className="text-rilo-accent font-bold">{formatBytes(item.speedBps)}/s</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-rilo-muted">Estimated Completion</span>
                      <span className="text-rilo-primary">{item.etaSeconds ? formatEta(item.etaSeconds) : "Calculating..."}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-3">
              <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-rilo-muted">Parallel Connection Threads</span>
                  <span className="text-rilo-accent font-bold">{item.activeThreads} Threads</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-rilo-muted">HTTP Range Support</span>
                  <span className={item.resumable ? "text-emerald-400" : "text-rose-400"}>
                    {item.resumable ? "Supported (Pause/Resume Available)" : "Unsupported (Single Segment Only)"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-rilo-muted">Task ID</span>
                  <span className="text-rilo-secondary font-mono text-[10px]">{item.id}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-rilo-surface border-t border-rilo-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Button variant="ghost" size="sm" onClick={() => { onRemove(item.id); onClose(); }} title="Remove record from Rilo list only">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Remove from List</span>
            </Button>
            {onDeleteFileDisk && (
              <Button variant="danger" size="sm" onClick={() => { onDeleteFileDisk(item); onClose(); }} title="Permanently delete downloaded file from hard drive">
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span>Delete File</span>
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isCompleted && (
              <>
                <Button variant="emerald" size="sm" onClick={() => onOpenFile(item.savePath)}>
                  <FileCheck className="w-3.5 h-3.5 mr-1" />
                  <span>Open</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenFolder(item.savePath)}>
                  <FolderOpen className="w-3.5 h-3.5 mr-1" />
                  <span>Folder</span>
                </Button>
              </>
            )}

            {isDownloading && (
              <Button variant="amber" size="sm" onClick={() => onPause(item.id)}>
                <Pause className="w-3.5 h-3.5 mr-1" />
                <span>Pause</span>
              </Button>
            )}

            {isPaused && (
              <Button variant="emerald" size="sm" onClick={() => onResume(item)}>
                <Play className="w-3.5 h-3.5 mr-1" />
                <span>Resume</span>
              </Button>
            )}

            {(isPaused || statusLower === "error") && (
              <Button variant="amber" size="sm" onClick={() => onRefreshLink(item)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                <span>Refresh Link</span>
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
