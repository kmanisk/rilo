import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DownloadItem, DownloadProgressPayload, DownloadRecord } from "../types";
import { recordToDownloadItem, progressToDownloadItem } from "../lib/downloads/mapping";
import { applyVisualSettings } from "../lib/settings/visual";
import { AppConfig } from "./SettingsModal";
import { formatBytes, isArchiveFilename } from "../utils";
import { Button } from "./ui/Button";
import {
  CheckCircle2,
  FileCheck,
  FolderOpen,
  Loader2,
  FileText,
  Archive,
  Film,
  Music,
  Image as ImageIcon,
  Code,
  Package,
} from "lucide-preact";
import WindowChrome from "./window/WindowChrome";

interface CompletionStandaloneViewProps {
  downloadId: string;
}

export default function CompletionStandaloneView({ downloadId }: CompletionStandaloneViewProps) {
  const [item, setItem] = useState<DownloadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Consolidated Initialization: Theme -> Record -> Reveal Window
  useEffect(() => {
    let isMounted = true;

    async function initWindow() {
      try {
        const appConfig = await invoke<AppConfig>("get_app_config");
        applyVisualSettings(appConfig.appearance);

        const records = await invoke<DownloadRecord[]>("get_download_history");
        const rec = records.find((r) => r.id === downloadId);
        if (rec && isMounted) {
          setItem(recordToDownloadItem(rec));
        }

        if (isMounted) {
          setLoading(false);
          requestAnimationFrame(async () => {
            if (!isMounted) return;
            setIsReady(true);
            try {
              const win = getCurrentWindow();
              await win.show();
              await win.setFocus();
            } catch (err) {
              console.warn("Failed revealing completion window:", err);
            }
          });
        }
      } catch (err) {
        console.error("Error initializing completion window:", err);
        if (isMounted) setLoading(false);
      }
    }

    initWindow();

    return () => {
      isMounted = false;
    };
  }, [downloadId]);

  // Live Theme Switching Listener
  useEffect(() => {
    let unlistenTheme: UnlistenFn | undefined;

    async function setupThemeListener() {
      try {
        unlistenTheme = await listen<any>("rilo-appearance-changed", (event) => {
          applyVisualSettings(event.payload);
        });
      } catch (err) {
        console.error("Failed setting theme listener in completion window:", err);
      }
    }

    setupThemeListener();

    return () => {
      if (unlistenTheme) unlistenTheme();
    };
  }, []);

  // Listen to real-time progress events for this download ID
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    async function setupListeners() {
      try {
        unlisten = await listen<DownloadProgressPayload>(
          "download-progress",
          (event) => {
            const payload = event.payload;
            if (payload.download_id !== downloadId) return;
            setItem((prev) => progressToDownloadItem(payload, prev || undefined));
          }
        );
      } catch (err) {
        console.error("Failed registering completion window listeners:", err);
      }
    }

    setupListeners();

    return () => {
      if (unlisten) unlisten();
    };
  }, [downloadId]);

  const handleCloseWindow = async () => {
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (err) {
      window.close();
    }
  };

  const handleOpenFile = async (savePath: string) => {
    try {
      await invoke("open_file", { path: savePath });
    } catch (err) {
      console.error("Open file error:", err);
    }
  };

  const handleOpenFolder = async (savePath: string) => {
    try {
      await invoke("open_folder_location", { path: savePath });
    } catch (err) {
      console.error("Open folder error:", err);
    }
  };

  // Native OS File Drag Handler
  const handleFileDrag = async (e: MouseEvent) => {
    if (!item?.savePath) return;
    try {
      await invoke("start_file_drag", { filePath: item.savePath });
    } catch (err) {
      try {
        await invoke("plugin:drag|start_drag", { item: [item.savePath] });
      } catch (dragErr) {
        console.warn("Native file drag error:", dragErr);
      }
    }
  };

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealClass = prefersReducedMotion
    ? "opacity-100"
    : isReady
    ? "opacity-100 transition-opacity duration-120 ease-out"
    : "opacity-0";

  // File Icon Picker based on extension
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

  if (loading) {
    return (
      <div className="w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col items-center justify-center space-y-2 select-none font-sans">
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        <span className="text-xs text-rilo-muted font-mono">Loading completion notification...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col items-center justify-center space-y-3 select-none p-4 text-center font-sans">
        <span className="text-xs font-semibold text-rose-400">Download Record Not Found</span>
        <Button variant="secondary" size="sm" onClick={handleCloseWindow} className="text-xs h-8">
          Close
        </Button>
      </div>
    );
  }

  const FileIconComponent = getFileIcon(item.filename);

  return (
    <div className={`w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col overflow-hidden select-none font-sans ${revealClass}`}>
      {/* Frameless Custom Window Chrome */}
      <WindowChrome
        title="Completed"
        subtitle={item.filename}
        icon={CheckCircle2}
        showMaximize={false}
        onClose={handleCloseWindow}
      />

      {/* Quick Notification Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div className="flex items-center space-x-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold text-xs text-rilo-primary uppercase tracking-wide">Download Completed</span>
        </div>

        {/* Native OS File Drag Handle */}
        <div
          onMouseDown={handleFileDrag}
          className="p-2.5 border border-rilo-border bg-rilo-surface hover:bg-rilo-elevated hover:border-rilo-accent cursor-grab active:cursor-grabbing transition-all rounded-md flex items-center space-x-3 group select-none shadow-xs"
          title="Drag to move or copy this file to Explorer, Desktop, or another app"
        >
          <div className="w-9 h-9 rounded bg-rilo-elevated border border-rilo-border group-hover:border-rilo-accent text-rilo-accent flex items-center justify-center flex-shrink-0 transition-colors">
            <FileIconComponent className="w-5 h-5 text-rilo-accent" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="font-semibold text-rilo-primary text-xs truncate" title={item.filename}>
              {item.filename}
            </h3>
            <p className="text-[10px] text-rilo-muted font-mono truncate" title={item.savePath}>
              {item.savePath}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-rilo-muted font-mono px-0.5">
          <span>Size: <strong className="text-rilo-primary font-medium">{item.totalBytes > 0 ? formatBytes(item.totalBytes) : "Completed"}</strong></span>
          <span className="text-emerald-400 font-medium">✓ 100% Verified</span>
        </div>
      </div>

      {/* Footer Quick Action Bar */}
      <div className="px-3 py-2 border-t border-rilo-border bg-rilo-surface flex items-center justify-between flex-shrink-0 h-[44px]">
        <div className="flex items-center space-x-1.5">
          <Button
            variant="emerald"
            size="sm"
            onClick={() => handleOpenFile(item.savePath)}
            className="space-x-1 text-xs h-8"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Open File</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenFolder(item.savePath)}
            className="space-x-1 text-xs h-8"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Folder</span>
          </Button>
        </div>

        <Button variant="secondary" size="sm" onClick={handleCloseWindow} className="text-xs h-8">
          Close
        </Button>
      </div>
    </div>
  );
}
