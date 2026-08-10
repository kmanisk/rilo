import { useEffect, useRef } from "preact/hooks";
import { DownloadItem } from "../types";
import { isArchiveFilename } from "../utils";
import {
  Play,
  Pause,
  Square,
  FileCheck,
  FolderOpen,
  Copy,
  Link as LinkIcon,
  RefreshCw,
  Archive,
  Trash2,
  FileText,
  Info,
} from "lucide-preact";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  item: DownloadItem;
  position: ContextMenuPosition;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onCancel: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRemove: (id: string) => void;
  onDeleteFileDisk: (item: DownloadItem) => void;
  onRefreshLink: (item: DownloadItem) => void;
  onOpenDetails: (item: DownloadItem) => void;
  onExtractArchive?: (item: DownloadItem) => void;
}

export default function ContextMenu({
  item,
  position,
  onClose,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
  onRemove,
  onDeleteFileDisk,
  onRefreshLink,
  onOpenDetails,
  onExtractArchive,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const statusLower = (item.status || "").toLowerCase();
  const isDownloading = statusLower === "downloading" || statusLower === "reconnecting" || statusLower === "restarting";
  const isPaused = statusLower === "paused" || statusLower === "queued" || statusLower === "error" || statusLower === "failed" || statusLower === "cancelled";
  const isCompleted = statusLower === "completed";
  const isArchive = isArchiveFilename(item.filename);

  // Close context menu on click outside or Escape key
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", handleDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Adjust menu coordinates so it remains strictly inside viewport boundaries
  const adjustedX = Math.max(8, Math.min(position.x, window.innerWidth - 220));
  const adjustedY = Math.max(8, Math.min(position.y, window.innerHeight - 340));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-52 bg-rilo-surface border border-rilo-border rounded-lg shadow-xl py-1 text-xs font-sans select-none animate-in fade-in duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* State-aware transfer controls */}
      {isDownloading && (
        <button
          onClick={() => {
            onPause(item.id);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-primary hover:bg-rilo-elevated transition-colors text-left"
        >
          <Pause className="w-3.5 h-3.5 text-amber-400" />
          <span>Pause Transfer</span>
        </button>
      )}

      {isPaused && (
        <button
          onClick={() => {
            onResume(item);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-primary hover:bg-rilo-elevated transition-colors text-left"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          <span>Resume Transfer</span>
        </button>
      )}

      {(isDownloading || isPaused) && (
        <button
          onClick={() => {
            onCancel(item.id);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-primary hover:bg-rilo-elevated transition-colors text-left"
        >
          <Square className="w-3.5 h-3.5 text-rose-400" />
          <span>Stop Task</span>
        </button>
      )}

      <div className="h-px bg-rilo-border my-1" />

      {/* File & Folder Open Actions */}
      {isCompleted && (
        <button
          onClick={() => {
            onOpenFile(item.savePath);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-primary hover:bg-rilo-elevated transition-colors text-left"
        >
          <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Open File</span>
        </button>
      )}

      <button
        onClick={() => {
          onOpenFolder(item.savePath);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-primary hover:bg-rilo-elevated transition-colors text-left"
      >
        <FolderOpen className="w-3.5 h-3.5 text-rilo-accent" />
        <span>Open Containing Folder</span>
      </button>

      {/* Archive Extraction Option */}
      {isArchive && isCompleted && onExtractArchive && (
        <button
          onClick={() => {
            onExtractArchive(item);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-primary hover:bg-rilo-elevated transition-colors text-left"
        >
          <Archive className="w-3.5 h-3.5 text-amber-400" />
          <span>Extract Archive...</span>
        </button>
      )}

      <div className="h-px bg-rilo-border my-1" />

      {/* Copy Actions */}
      <button
        onClick={() => copyToClipboard(item.url)}
        className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary transition-colors text-left"
      >
        <LinkIcon className="w-3.5 h-3.5 text-rilo-muted" />
        <span>Copy Download URL</span>
      </button>

      <button
        onClick={() => copyToClipboard(item.savePath)}
        className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary transition-colors text-left"
      >
        <Copy className="w-3.5 h-3.5 text-rilo-muted" />
        <span>Copy Local Path</span>
      </button>

      {(isPaused || statusLower === "error") && (
        <button
          onClick={() => {
            onRefreshLink(item);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-amber-400 hover:bg-rilo-elevated transition-colors text-left"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Expired Link</span>
        </button>
      )}

      <div className="h-px bg-rilo-border my-1" />

      {/* Delete Submenu / Options */}
      <button
        onClick={() => {
          onRemove(item.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary transition-colors text-left"
      >
        <Trash2 className="w-3.5 h-3.5 text-rilo-muted" />
        <span>Delete Download (From List)</span>
      </button>

      <button
        onClick={() => {
          onDeleteFileDisk(item);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2 text-rose-400 hover:bg-rose-500/10 transition-colors text-left font-semibold"
      >
        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
        <span>Delete Download + File</span>
      </button>

      <div className="h-px bg-rilo-border my-1" />

      {/* Details Window Inspector */}
      <button
        onClick={() => {
          onOpenDetails(item);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2 text-rilo-accent font-semibold hover:bg-rilo-elevated transition-colors text-left"
      >
        <Info className="w-3.5 h-3.5" />
        <span>Properties / Details</span>
      </button>
    </div>
  );
}
