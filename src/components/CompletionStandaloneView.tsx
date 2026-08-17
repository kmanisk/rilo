import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DownloadItem, DownloadProgressPayload, DownloadRecord } from "../types";
import { recordToDownloadItem, progressToDownloadItem } from "../lib/downloads/mapping";
import { applyVisualSettings, AppearanceSettings, parseScaleFactor } from "../lib/settings/visual";
import { AppConfig } from "./SettingsModal";
import { formatBytes } from "../utils";
import { Button } from "./ui/Button";
import {
  Check,
  Archive,
  Film,
  Music,
  Image as ImageIcon,
  Package,
  Code,
  FileText,
  Loader2,
  HardDrive,
} from "lucide-preact";
import { LogicalSize } from "@tauri-apps/api/dpi";
import WindowChrome from "./window/WindowChrome";

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
              const factor = parseScaleFactor(appConfig.appearance?.ui_scale);
              const targetW = Math.max(460, Math.round(460 * factor));
              const targetH = Math.max(180, Math.round(180 * factor));
              try {
                await win.setSize(new LogicalSize(targetW, targetH));
                await win.setResizable(false);
              } catch (e) {}
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

  // Live Theme & System Appearance Listener
  const activeAppearanceRef = useRef<AppearanceSettings | null>(null);

  useEffect(() => {
    let unlistenTheme: UnlistenFn | undefined;

    async function setupThemeListener() {
      try {
        const appConfig = await invoke<AppConfig>("get_app_config");
        activeAppearanceRef.current = appConfig.appearance;
        unlistenTheme = await listen<any>("rilo-appearance-changed", async (event) => {
          if (event.payload) {
            activeAppearanceRef.current = event.payload;
            applyVisualSettings(event.payload);
            const factor = parseScaleFactor(event.payload.ui_scale);
            const targetW = Math.max(460, Math.round(460 * factor));
            const targetH = Math.max(180, Math.round(180 * factor));
            try {
              const win = getCurrentWindow();
              await win.setSize(new LogicalSize(targetW, targetH));
            } catch (e) {}
          }
        });
      } catch (err) {
        console.error("Failed setting theme listener in completion window:", err);
      }
    }

    setupThemeListener();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const mode = activeAppearanceRef.current?.mode || "system";
      if (mode === "system" && activeAppearanceRef.current) {
        applyVisualSettings(activeAppearanceRef.current);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemChange);
    } else {
      mediaQuery.addListener(handleSystemChange);
    }

    return () => {
      if (unlistenTheme) unlistenTheme();
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemChange);
      } else {
        mediaQuery.removeListener(handleSystemChange);
      }
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

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealClass = prefersReducedMotion
    ? "opacity-100"
    : isReady
    ? "opacity-100 transition-opacity duration-120 ease-out"
    : "opacity-0";

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

  const FileIcon = getCategoryFileIcon(item.filename);

  return (
    <div className={`w-screen h-screen bg-rilo-surface text-rilo-primary flex flex-col justify-between overflow-hidden select-none font-sans ${revealClass}`}>
      {/* Frameless Custom Window Chrome */}
      <WindowChrome
        title={item.filename}
        icon={HardDrive}
        showMaximize={false}
        onClose={handleCloseWindow}
      />

      {/* Summary Body (Matching Reference Image 0) */}
      <div className="px-4 py-2 flex-1 flex items-center space-x-3 bg-rilo-surface min-h-0 overflow-hidden">
        {/* Left: Category/File Icon + File Size underneath */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[56px]">
          <div className="w-8 h-8 rounded-lg bg-rilo-elevated border border-rilo-border flex items-center justify-center text-rilo-accent shadow-xs shrink-0">
            <FileIcon className="w-4 h-4 text-rilo-accent" />
          </div>
          <span className="text-[11px] font-mono font-bold text-rilo-primary mt-1 text-center leading-tight whitespace-nowrap">
            {item.totalBytes > 0 ? formatBytes(item.totalBytes) : formatBytes(item.bytesDownloaded)}
          </span>
        </div>

        {/* Right: Green Check + Download Completed heading + Filename on single line */}
        <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
          <div className="flex items-center space-x-1.5">
            <Check className="w-4 h-4 text-emerald-400 stroke-[3] shrink-0" />
            <h2 className="text-xs font-bold text-emerald-400 tracking-wide truncate">
              Download Completed
            </h2>
          </div>
          <div className="text-xs font-medium text-rilo-primary truncate select-text font-mono" title={item.savePath || item.filename}>
            {item.filename}
          </div>
        </div>
      </div>

      {/* Footer Quick Action Bar */}
      <div className="px-3.5 py-2 border-t border-rilo-border bg-rilo-surface flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleOpenFile(item.savePath)}
            className="text-xs h-7 px-3.5 font-semibold shrink-0"
          >
            Open
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleOpenFolder(item.savePath)}
            className="text-xs h-7 px-3 shrink-0"
          >
            Open Folder
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCloseWindow}
          className="text-xs h-7 px-3.5 shrink-0"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
