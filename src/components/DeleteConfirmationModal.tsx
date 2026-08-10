import { DownloadItem } from "../types";
import { formatBytes } from "../utils";
import { Button } from "./ui/Button";
import { AlertTriangle, Trash2, X } from "lucide-preact";

interface DeleteConfirmationModalProps {
  item: DownloadItem;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export default function DeleteConfirmationModal({
  item,
  onClose,
  onConfirmDelete,
}: DeleteConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-150">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl max-w-md w-full shadow-2xl p-5 space-y-4">
        <div className="flex items-center space-x-3 border-b border-rilo-border pb-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rilo-primary">Delete file from disk?</h3>
            <p className="text-[11px] text-rilo-muted font-mono">Permanent filesystem removal</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2 text-xs text-rilo-secondary">
          <p className="text-rilo-primary font-semibold">
            Are you sure you want to delete this file from your computer?
          </p>
          <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg font-mono space-y-1 text-[11px]">
            <div>
              <span className="text-rilo-muted text-[10px] block">Filename</span>
              <span className="text-rilo-primary font-bold break-all">{item.filename}</span>
            </div>
            <div>
              <span className="text-rilo-muted text-[10px] block">Size</span>
              <span className="text-rilo-accent font-bold">{item.totalBytes > 0 ? formatBytes(item.totalBytes) : formatBytes(item.bytesDownloaded)}</span>
            </div>
            <div>
              <span className="text-rilo-muted text-[10px] block">File Location</span>
              <span className="text-rilo-secondary break-all">{item.savePath}</span>
            </div>
          </div>
          <p className="text-rose-400 text-[11px]">
            Warning: This action will permanently remove the file from your hard drive and cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-rilo-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onConfirmDelete();
              onClose();
            }}
            className="space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete File</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
