import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DownloadItem, DownloadProgressPayload, DownloadRecord, ExtractionProgressPayload } from "../types";
import { applyExtractionProgress, progressToDownloadItem, recordToDownloadItem } from "../lib/downloads/mapping";
import DownloadDetailsModal from "./DownloadDetailsModal";
import { AppConfig } from "./SettingsModal";
import { applyVisualSettings } from "../lib/settings/visual";
import { Loader2 } from "lucide-preact";

interface DetailsStandaloneViewProps {
  downloadId: string;
}

export default function DetailsStandaloneView({ downloadId }: DetailsStandaloneViewProps) {
  const [item, setItem] = useState<DownloadItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Consolidated Initialization: Theme -> Record -> Reveal Window
  useEffect(() => {
    let isMounted = true;

    async function initWindow() {
      try {
        // 1. Apply persisted visual theme before first paint
        const appConfig = await invoke<AppConfig>("get_app_config");
        applyVisualSettings(appConfig.appearance);

        // 2. Fetch record from SQLite history
        const records = await invoke<DownloadRecord[]>("get_download_history");
        const rec = records.find((r) => r.id === downloadId);
        if (!rec) {
          try {
            await getCurrentWindow().close();
          } catch (e) {
            window.close();
          }
          return;
        }

        if (isMounted) {
          setItem(recordToDownloadItem(rec));
          setLoading(false);
          requestAnimationFrame(async () => {
            if (!isMounted) return;
            setIsReady(true);
            try {
              const win = getCurrentWindow();
              await win.show();
              await win.setFocus();
            } catch (err) {
              console.warn("Failed revealing details window:", err);
            }
          });
        }
      } catch (err) {
        console.error("Error initializing details window:", err);
        try {
          await getCurrentWindow().close();
        } catch (e) {}
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
        console.error("Failed setting theme listener in details window:", err);
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
    let unlistenExt: UnlistenFn | undefined;

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

        unlistenExt = await listen<ExtractionProgressPayload>(
          "extraction-progress",
          (event) => {
            const payload = event.payload;
            if (payload.download_id !== downloadId) return;

            setItem((prev) => {
              if (!prev) return prev;
              return applyExtractionProgress(prev, payload);
            });
          }
        );
      } catch (err) {
        console.error("Failed registering details window listeners:", err);
      }
    }

    setupListeners();

    return () => {
      if (unlisten) unlisten();
      if (unlistenExt) unlistenExt();
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

  const handlePause = async (id: string) => {
    try {
      await invoke("pause_download", { downloadId: id });
    } catch (err) {
      console.error("Pause error:", err);
    }
  };

  const handleResume = async (targetItem: DownloadItem) => {
    try {
      await invoke("resume_download", {
        downloadId: targetItem.id,
        url: targetItem.url,
        customPath: targetItem.savePath,
        numConnections: targetItem.activeThreads || 4,
      });
    } catch (err) {
      console.error("Resume error:", err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await invoke("delete_download_history", { downloadId: id });
      handleCloseWindow();
    } catch (err) {
      console.error("Remove error:", err);
    }
  };

  const handleDeleteFileDisk = async (targetItem: DownloadItem) => {
    try {
      await invoke("delete_download_file", {
        downloadId: targetItem.id,
        filePath: targetItem.savePath,
      });
      handleCloseWindow();
    } catch (err) {
      console.error("Delete file error:", err);
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
    ? "opacity-100 transition-opacity duration-150 ease-out"
    : "opacity-0";

  if (loading) {
    return (
      <div className="w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col items-center justify-center space-y-2 select-none font-sans">
        <Loader2 className="w-5 h-5 text-rilo-accent animate-spin" />
        <span className="text-xs text-rilo-muted font-mono">Loading inspector...</span>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div className={`w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col overflow-hidden select-none font-sans ${revealClass}`}>
      <DownloadDetailsModal
        item={item}
        isStandaloneWindow={true}
        onClose={handleCloseWindow}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onPause={handlePause}
        onResume={handleResume}
        onRemove={handleRemove}
        onDeleteFileDisk={handleDeleteFileDisk}
      />
    </div>
  );
}
