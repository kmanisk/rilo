import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DownloadItem, DownloadProgressPayload, DownloadRecord, ExtractionProgressPayload } from "../types";
import { generateDeterministicSegments } from "../utils";
import DownloadDetailsModal from "./DownloadDetailsModal";
import { AppConfig, applyVisualSettings } from "./SettingsModal";
import { Loader2 } from "lucide-preact";

interface DetailsStandaloneViewProps {
  downloadId: string;
}

export default function DetailsStandaloneView({ downloadId }: DetailsStandaloneViewProps) {
  const [item, setItem] = useState<DownloadItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Appearance & Accent Color Settings
  useEffect(() => {
    async function initAppearance() {
      try {
        const appConfig = await invoke<AppConfig>("get_app_config");
        applyVisualSettings(appConfig.appearance);
      } catch (err) {
        console.error("Error loading app config in details window:", err);
      }
    }
    initAppearance();
  }, []);

  // Fetch download item record from SQLite
  useEffect(() => {
    async function loadItem() {
      try {
        const records = await invoke<DownloadRecord[]>("get_download_history");
        const rec = records.find((r) => r.id === downloadId);

        if (rec) {
          const statusLower = (rec.status || "").toLowerCase();
          const threads = rec.threads || 4;
          const initialSegments = generateDeterministicSegments(
            rec.total_bytes,
            threads,
            rec.downloaded_bytes,
            statusLower
          );

          setItem({
            id: rec.id,
            url: rec.url,
            redirectUrl: rec.redirect_url,
            filename: rec.filename,
            savePath: rec.save_path,
            bytesDownloaded: rec.downloaded_bytes,
            totalBytes: rec.total_bytes,
            status: (statusLower as any) || "completed",
            startTime: Number(rec.created_at) * 1000 || Date.now(),
            speedBps: 0,
            activeThreads: threads,
            resumable: rec.resumable ?? true,
            etag: rec.etag,
            lastModified: rec.last_modified,
            mimeType: rec.mime_type,
            createdAt: rec.created_at,
            segments: initialSegments,
            autoExtract: rec.auto_extract,
            extractDir: rec.extract_dir,
            deleteArchiveAfterExtract: rec.delete_archive_after_extract,
            extractionState: rec.extraction_state as any,
          });
        }
      } catch (err) {
        console.error("Error fetching record for details window:", err);
      } finally {
        setLoading(false);
      }
    }
    loadItem();
  }, [downloadId]);

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

            const statusLower = (payload.status || "").toLowerCase();

            setItem((prev) => {
              const prevSpeed = prev?.speedBps || 0;
              const rawSpeed = payload.speed_bps || 0;
              let smoothedSpeed = 0;
              if (statusLower === "paused" || statusLower === "completed" || rawSpeed === 0) {
                smoothedSpeed = 0;
              } else if (prevSpeed === 0) {
                smoothedSpeed = rawSpeed;
              } else {
                smoothedSpeed = Math.round(prevSpeed * 0.7 + rawSpeed * 0.3);
              }

              let etaSeconds = payload.eta_seconds;
              if (smoothedSpeed > 0 && payload.total_bytes > payload.bytes_downloaded) {
                etaSeconds = Math.round((payload.total_bytes - payload.bytes_downloaded) / smoothedSpeed);
              }

              const hasIncomingSegments = Array.isArray(payload.segments) && payload.segments.length > 0;
              let mergedSegments = hasIncomingSegments ? payload.segments : prev?.segments;

              if (!mergedSegments || mergedSegments.length === 0) {
                if (payload.total_bytes > 0 && (payload.active_threads || 4) > 0) {
                  mergedSegments = generateDeterministicSegments(
                    payload.total_bytes,
                    payload.active_threads || 4,
                    payload.bytes_downloaded,
                    payload.status
                  );
                }
              }

              return {
                id: payload.download_id,
                url: prev?.url || "",
                redirectUrl: prev?.redirectUrl,
                filename: payload.filename || prev?.filename || "download.bin",
                savePath: payload.save_path || prev?.savePath || "",
                bytesDownloaded: payload.bytes_downloaded,
                totalBytes: payload.total_bytes,
                status: statusLower as any,
                errorMessage: payload.error_message,
                startTime: prev?.startTime || Date.now(),
                speedBps: smoothedSpeed,
                etaSeconds: etaSeconds,
                activeThreads: payload.active_threads || prev?.activeThreads || 4,
                resumable: payload.resumable ?? prev?.resumable ?? true,
                etag: payload.etag || prev?.etag,
                lastModified: payload.last_modified || prev?.lastModified,
                mimeType: payload.mime_type || prev?.mimeType,
                createdAt: prev?.createdAt,
                segments: mergedSegments,
                autoExtract: prev?.autoExtract,
                extractDir: prev?.extractDir,
                deleteArchiveAfterExtract: prev?.deleteArchiveAfterExtract,
                extractionState: prev?.extractionState,
              };
            });
          }
        );

        unlistenExt = await listen<ExtractionProgressPayload>(
          "extraction-progress",
          (event) => {
            const payload = event.payload;
            if (payload.download_id !== downloadId) return;

            setItem((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                extractionState: payload.state,
                extractionProgress: payload,
              };
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

  if (loading) {
    return (
      <div className="w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col items-center justify-center space-y-2 select-none font-sans">
        <Loader2 className="w-6 h-6 text-rilo-accent animate-spin" />
        <span className="text-xs text-rilo-muted font-mono">Loading download inspector...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col items-center justify-center space-y-3 select-none p-6 text-center font-sans">
        <span className="text-xs font-semibold text-rose-400">Download Record Not Found</span>
        <p className="text-[11px] text-rilo-muted max-w-xs">
          The requested task details could not be loaded or the record was removed.
        </p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col overflow-hidden select-none font-sans">
      <DownloadDetailsModal
        item={item}
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
