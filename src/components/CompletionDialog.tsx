import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { DownloadItem } from "../types";
import { formatBytes } from "../utils";
import { Button } from "./ui/Button";
import { CheckCircle2, AlertTriangle, FileCheck, FolderOpen, X, Power } from "lucide-preact";

interface CompletionDialogProps {
  item: DownloadItem;
  action?: string; // "none" | "notify" | "open_file" | "open_folder" | "sleep" | "hibernate" | "shutdown" | "force_shutdown"
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

export default function CompletionDialog({
  item,
  action = "none",
  onClose,
  onOpenFile,
  onOpenFolder,
}: CompletionDialogProps) {
  const isShutdown = action === "shutdown" || action === "force_shutdown";
  const isForceShutdown = action === "force_shutdown";

  const [countdown, setCountdown] = useState<number>(30);
  const [cancelledShutdown, setCancelledShutdown] = useState<boolean>(false);

  useEffect(() => {
    if (!isShutdown || cancelledShutdown) return;

    if (countdown <= 0) {
      // Trigger actual system shutdown command via Tauri IPC
      invoke("execute_system_action", {
        action: "shutdown",
        force: isForceShutdown,
      }).catch((err) => console.error("Failed executing shutdown action:", err));
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, isShutdown, isForceShutdown, cancelledShutdown]);

  const handleCancelShutdown = async () => {
    setCancelledShutdown(true);
    try {
      await invoke("cancel_system_shutdown");
    } catch (err) {
      console.error("Failed to cancel shutdown:", err);
    }
  };

  const handleImmediateShutdown = async () => {
    try {
      await invoke("execute_system_action", {
        action: "shutdown",
        force: isForceShutdown,
      });
    } catch (err) {
      console.error("Failed immediate shutdown:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isShutdown) onClose();
      }}
    >
      <div className="bg-rilo-surface border border-rilo-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Titlebar Header */}
        <div className="bg-rilo-surface border-b border-rilo-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-rilo-primary uppercase tracking-wider">
              Download Complete
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close Dialog">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Dialog Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="space-y-1">
            <h4 className="font-bold text-rilo-primary text-sm break-all" title={item.filename}>
              {item.filename}
            </h4>
            <p className="text-[11px] text-rilo-muted font-mono break-all">{item.savePath}</p>
          </div>

          <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-rilo-muted block font-sans">File Size</span>
              <span className="text-rilo-primary font-bold">{formatBytes(item.totalBytes)}</span>
            </div>
            <div>
              <span className="text-[10px] text-rilo-muted block font-sans">Transfer State</span>
              <span className="text-emerald-400 font-bold">100% Completed</span>
            </div>
          </div>

          {/* Shutdown Countdown Section */}
          {isShutdown && !cancelledShutdown && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 space-y-2 text-amber-300">
              <div className="flex items-center space-x-2">
                <Power className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-bold text-xs">
                  {isForceShutdown ? "Force Shutdown Scheduled" : "System Shutdown Scheduled"}
                </span>
              </div>

              {isForceShutdown && (
                <div className="flex items-start space-x-1.5 text-[10px] text-rose-300 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    WARNING: Force shutdown may close applications without allowing them to save unsaved work.
                  </span>
                </div>
              )}

              <p className="text-[11px] font-mono">
                The computer will shut down in <strong className="text-amber-200 text-sm font-bold">{countdown}</strong> seconds.
              </p>

              <div className="flex items-center space-x-2 pt-1">
                <Button variant="danger" size="sm" onClick={handleCancelShutdown} className="flex-1 text-[11px]">
                  Cancel Shutdown
                </Button>
                <Button variant="amber" size="sm" onClick={handleImmediateShutdown} className="flex-1 text-[11px]">
                  Shutdown Now
                </Button>
              </div>
            </div>
          )}

          {cancelledShutdown && (
            <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-2.5 text-center text-rilo-muted text-[11px] font-mono">
              System shutdown has been cancelled.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-rilo-border bg-rilo-surface flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenFolder(item.savePath);
              onClose();
            }}
            className="space-x-1"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Folder</span>
          </Button>

          <Button
            variant="emerald"
            size="sm"
            onClick={() => {
              onOpenFile(item.savePath);
              onClose();
            }}
            className="space-x-1"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Open File</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
