import { DuplicateDownloadInfo } from "../types";
import { formatBytes } from "../utils";
import { Button } from "./ui/Button";
import { Copy, X, Play, Eye, DownloadCloud, AlertCircle } from "lucide-preact";
import { useEffect } from "preact/hooks";

interface DuplicateDownloadModalProps {
  duplicate: DuplicateDownloadInfo;
  onClose: () => void;
  onResume: (id: string) => void;
  onShowExisting: (id: string) => void;
  onDownloadAnyway: () => void;
}

export default function DuplicateDownloadModal({
  duplicate,
  onClose,
  onResume,
  onShowExisting,
  onDownloadAnyway,
}: DuplicateDownloadModalProps) {
  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isPaused = duplicate.status.toLowerCase() === "paused";
  const isCompleted = duplicate.status.toLowerCase() === "completed";
  const isDownloading = duplicate.status.toLowerCase() === "downloading";

  const getStatusBadge = () => {
    switch (duplicate.status.toLowerCase()) {
      case "downloading":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rilo-accent-muted text-rilo-accent border border-rilo-accent/40">Active / Downloading</span>;
      case "paused":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">Paused</span>;
      case "completed":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Completed on Disk</span>;
      case "queued":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">Queued</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rilo-elevated text-rilo-secondary border border-rilo-border">{duplicate.status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-rilo-overlay backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-150">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl max-w-md w-full rilo-modal-shadow overflow-hidden p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-rilo-border pb-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Copy className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rilo-primary">Download Already Exists</h3>
            <p className="text-[11px] text-rilo-muted font-mono">This URL is already in your download list</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-xs">
          <div className="flex items-start space-x-2 text-rilo-secondary">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              A matching task for this source URL was found in your download manager.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-rilo-elevated border border-rilo-border p-3.5 rounded-lg space-y-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-rilo-muted text-[10px] uppercase tracking-wider font-semibold">Status</span>
              {getStatusBadge()}
            </div>

            <div>
              <span className="text-rilo-muted text-[10px] block font-semibold uppercase tracking-wider">Source URL</span>
              <span className="text-rilo-accent font-mono text-[10px] break-all line-clamp-2" title={duplicate.url}>
                {duplicate.url}
              </span>
            </div>

            <div>
              <span className="text-rilo-muted text-[10px] block font-semibold uppercase tracking-wider">Filename</span>
              <span className="text-rilo-primary font-bold break-all">{duplicate.filename}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rilo-border/50">
              <div>
                <span className="text-rilo-muted text-[10px] block">Downloaded</span>
                <span className="text-rilo-accent font-semibold">{formatBytes(duplicate.downloaded_bytes)}</span>
              </div>
              <div>
                <span className="text-rilo-muted text-[10px] block">Total Size</span>
                <span className="text-rilo-secondary font-semibold">
                  {duplicate.total_bytes > 0 ? formatBytes(duplicate.total_bytes) : "Unknown"}
                </span>
              </div>
            </div>

            <div className="pt-1 border-t border-rilo-border/50">
              <span className="text-rilo-muted text-[10px] block">Save Location</span>
              <span className="text-rilo-secondary text-[10px] font-mono break-all line-clamp-1" title={duplicate.save_path}>
                {duplicate.save_path}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-rilo-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>

          {isPaused && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                onResume(duplicate.id);
                onClose();
              }}
              className="space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Existing</span>
            </Button>
          )}

          {(isDownloading || isCompleted) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onShowExisting(duplicate.id);
                onClose();
              }}
              className="space-x-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show in List</span>
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={() => {
              onDownloadAnyway();
              onClose();
            }}
            className="space-x-1.5"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Download Anyway</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
