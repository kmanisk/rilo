import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { DownloadItem, DownloadProgressPayload, DownloadRecord, ExtractionProgressPayload } from "./types";
import { getCategoryFromFilename, generateDeterministicSegments } from "./utils";

import Toolbar from "./components/Toolbar";
import Sidebar, { CategoryTab } from "./components/Sidebar";
import DownloadGrid from "./components/DownloadGrid";
import DownloadDetailsModal from "./components/DownloadDetailsModal";
import CompletionDialog from "./components/CompletionDialog";
import StatusBar from "./components/StatusBar";
import NewDownloadModal from "./components/NewDownloadModal";
import UpdateUrlModal from "./components/UpdateUrlModal";
import AboutModal from "./components/AboutModal";
import SchedulerModal from "./components/SchedulerModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import { SettingsModal, AppConfig, applyVisualSettings } from "./components/SettingsModal";

export default function App() {
  const [downloads, setDownloads] = useState<Record<string, DownloadItem>>({});
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<DownloadItem | null>(null);
  const [detailsModalItem, setDetailsModalItem] = useState<DownloadItem | null>(null);
  const [completionDialogItem, setCompletionDialogItem] = useState<{ item: DownloadItem; action: string } | null>(null);
  const [refreshItem, setRefreshItem] = useState<DownloadItem | null>(null);
  const [deleteModalItem, setDeleteModalItem] = useState<DownloadItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [showNewModal, setShowNewModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const completedTrackedRef = useRef<Set<string>>(new Set());

  // Load Appearance & Typography settings from persistent AppData AppConfig on startup
  useEffect(() => {
    async function initAppearance() {
      try {
        const appConfig = await invoke<AppConfig>("get_app_config");
        applyVisualSettings(appConfig.appearance);
        setTheme(appConfig.appearance.theme as 'dark' | 'light');
      } catch (err) {
        console.error("Error loading Rilo app config:", err);
      }
    }
    initAppearance();
  }, []);

  // Desktop Keyboard Shortcuts (Ctrl+F, Ctrl+N, Space, Delete, Enter, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setShowNewModal(true);
      } else if (selectedItem) {
        const statusLower = (selectedItem.status || "").toLowerCase();
        if (e.key === "Delete") {
          e.preventDefault();
          handleRemove(selectedItem.id);
        } else if (e.code === "Space") {
          e.preventDefault();
          if (statusLower === "downloading") {
            handlePause(selectedItem.id);
          } else if (statusLower === "paused" || statusLower === "queued" || statusLower === "error") {
            handleResume(selectedItem);
          }
        } else if (e.key === "Enter" && statusLower === "completed") {
          e.preventDefault();
          handleOpenFile(selectedItem.savePath);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem]);

  // Load history from SQLite DB on startup
  useEffect(() => {
    async function loadHistory() {
      try {
        const records = await invoke<DownloadRecord[]>("get_download_history");
        const historyMap: Record<string, DownloadItem> = {};
        records.forEach((rec) => {
          const statusLower = (rec.status || "").toLowerCase();
          const threads = rec.threads || 4;
          const initialSegments = generateDeterministicSegments(
            rec.total_bytes,
            threads,
            rec.downloaded_bytes,
            statusLower
          );

          if (statusLower === "completed") {
            completedTrackedRef.current.add(rec.id);
          }

          historyMap[rec.id] = {
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
          };
        });
        setDownloads(historyMap);
      } catch (err) {
        console.error("Error loading SQLite history:", err);
      }
    }
    loadHistory();
  }, []);

  // Listen to Tauri real-time IPC events
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let unlistenExt: UnlistenFn | undefined;
    let unlistenExtraction: UnlistenFn | undefined;

    async function setupListeners() {
      try {
        unlisten = await listen<DownloadProgressPayload>(
          "download-progress",
          (event) => {
            const payload = event.payload;
            const statusLower = (payload.status || "").toLowerCase();

            setDownloads((prev) => {
              const existing = prev[payload.download_id];
              const prevSpeed = existing?.speedBps || 0;
              const rawSpeed = payload.speed_bps || 0;

              // Exponential Moving Average (EMA) speed smoothing (alpha = 0.3)
              let smoothedSpeed = 0;
              if (statusLower === "paused" || statusLower === "completed" || rawSpeed === 0) {
                smoothedSpeed = 0;
              } else if (prevSpeed === 0) {
                smoothedSpeed = rawSpeed;
              } else {
                smoothedSpeed = Math.round(prevSpeed * 0.7 + rawSpeed * 0.3);
              }

              // Compute stable ETA from smoothed speed
              let etaSeconds = payload.eta_seconds;
              if (smoothedSpeed > 0 && payload.total_bytes > payload.bytes_downloaded) {
                etaSeconds = Math.round((payload.total_bytes - payload.bytes_downloaded) / smoothedSpeed);
              }

              const hasIncomingSegments = Array.isArray(payload.segments) && payload.segments.length > 0;
              let mergedSegments = hasIncomingSegments ? payload.segments : existing?.segments;

              if (!mergedSegments || mergedSegments.length === 0) {
                if (payload.total_bytes > 0 && (payload.active_threads || 4) > 0) {
                  mergedSegments = generateDeterministicSegments(
                    payload.total_bytes,
                    payload.active_threads || 4,
                    payload.bytes_downloaded,
                    payload.status
                  );
                }
              } else if (mergedSegments && mergedSegments.length > 0) {
                if (statusLower === "paused" || statusLower === "queued") {
                  mergedSegments = mergedSegments.map((seg) => ({
                    ...seg,
                    state: "paused",
                    current_speed_bps: 0,
                  }));
                } else if (statusLower === "completed") {
                  mergedSegments = mergedSegments.map((seg) => ({
                    ...seg,
                    state: "completed",
                    progress_percent: 100,
                    downloaded_bytes: seg.total_bytes || seg.downloaded_bytes,
                    current_speed_bps: 0,
                  }));
                }
              }

              const updatedItem: DownloadItem = {
                id: payload.download_id,
                url: existing?.url || "",
                redirectUrl: existing?.redirectUrl,
                filename: payload.filename || existing?.filename || "download.bin",
                savePath: payload.save_path || existing?.savePath || "",
                bytesDownloaded: payload.bytes_downloaded,
                totalBytes: payload.total_bytes,
                status: statusLower as any,
                errorMessage: payload.error_message,
                startTime: existing?.startTime || Date.now(),
                speedBps: smoothedSpeed,
                etaSeconds: etaSeconds,
                activeThreads: payload.active_threads || existing?.activeThreads || 4,
                resumable: payload.resumable ?? existing?.resumable ?? true,
                etag: payload.etag || existing?.etag,
                lastModified: payload.last_modified || existing?.lastModified,
                mimeType: payload.mime_type || existing?.mimeType,
                createdAt: existing?.createdAt,
                segments: mergedSegments,
              };

              // Handle post-completion triggers once per download session
              if (statusLower === "completed" && !completedTrackedRef.current.has(payload.download_id)) {
                completedTrackedRef.current.add(payload.download_id);
                showNotification(`Download completed: ${updatedItem.filename}`);
                setCompletionDialogItem({ item: updatedItem, action: "none" });
              }

              setSelectedItem((current) => {
                if (current && current.id === payload.download_id) {
                  return updatedItem;
                }
                return current;
              });

              setDetailsModalItem((current) => {
                if (current && current.id === payload.download_id) {
                  return updatedItem;
                }
                return current;
              });

              return {
                ...prev,
                [payload.download_id]: updatedItem,
              };
            });
          }
        );

        unlistenExt = await listen<{ url: string; filename?: string }>(
          "extension-download",
          (event) => {
            const payload = event.payload;
            if (payload && payload.url) {
              showNotification(`Browser extension link intercepted: ${payload.url}`);
              handleStartDownload(payload.url, "", 4);
            }
          }
        );

        unlistenExtraction = await listen<ExtractionProgressPayload>(
          "extraction-progress",
          (event) => {
            const payload = event.payload;
            setDownloads((prev) => {
              const existing = prev[payload.download_id];
              if (!existing) return prev;

              const updatedItem: DownloadItem = {
                ...existing,
                extractionState: payload.state,
                extractionProgress: payload,
              };

              setSelectedItem((current) => {
                if (current && current.id === payload.download_id) {
                  return updatedItem;
                }
                return current;
              });

              setDetailsModalItem((current) => {
                if (current && current.id === payload.download_id) {
                  return updatedItem;
                }
                return current;
              });

              return {
                ...prev,
                [payload.download_id]: updatedItem,
              };
            });
          }
        );
      } catch (err) {
        console.error("Failed to register Tauri event listeners:", err);
      }
    }

    setupListeners();

    return () => {
      if (unlisten) unlisten();
      if (unlistenExt) unlistenExt();
      if (unlistenExtraction) unlistenExtraction();
    };
  }, []);

  const handleStartDownload = async (
    url: string,
    customPath?: string,
    connections?: number,
    queueOnly = false,
    autoExtract = false,
    extractDir = "",
    deleteArchiveAfterExtract = false
  ) => {
    const downloadId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newItem: DownloadItem = {
      id: downloadId,
      url,
      filename: "Initializing...",
      savePath: customPath || "Downloads",
      bytesDownloaded: 0,
      totalBytes: 0,
      status: queueOnly ? "queued" : "downloading",
      startTime: Date.now(),
      speedBps: 0,
      activeThreads: connections || 4,
      resumable: true,
      autoExtract,
      extractDir,
      deleteArchiveAfterExtract,
      extractionState: "Pending",
    };

    setDownloads((prev) => ({ ...prev, [downloadId]: newItem }));
    setSelectedItem(newItem);

    try {
      if (autoExtract || extractDir || deleteArchiveAfterExtract) {
        await invoke("update_download_extraction_config", {
          downloadId,
          autoExtract,
          extractDir: extractDir || null,
          deleteAfter: deleteArchiveAfterExtract,
        });
      }

      await invoke("start_download", {
        downloadId,
        url,
        customPath: customPath || null,
        numConnections: connections || 4,
      });
      showNotification("Download task started");
    } catch (err: any) {
      console.error("Failed starting download:", err);
      showNotification(`Error: ${err?.message || err}`);
      setDownloads((prev) => {
        const item = prev[downloadId];
        if (!item) return prev;
        return {
          ...prev,
          [downloadId]: { ...item, status: "error", errorMessage: String(err) },
        };
      });
    }
  };

  const handleResume = async (item: DownloadItem) => {
    setDownloads((prev) => ({
      ...prev,
      [item.id]: { ...item, status: "downloading" },
    }));

    try {
      await invoke("resume_download", {
        downloadId: item.id,
        url: item.url,
        customPath: item.savePath,
        numConnections: item.activeThreads || 4,
      });
      showNotification("Resuming download transfer...");
    } catch (err: any) {
      console.error("Failed resuming download:", err);
      showNotification(`Failed to resume: ${err?.message || err}`);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await invoke("pause_download", { downloadId: id });
      setDownloads((prev) => {
        const item = prev[id];
        if (!item) return prev;
        return {
          ...prev,
          [id]: { ...item, status: "paused", speedBps: 0, etaSeconds: undefined },
        };
      });
      showNotification("Download paused");
    } catch (err: any) {
      console.error("Failed pausing download:", err);
    }
  };

  const handleUpdateUrl = async (item: DownloadItem, newUrl: string) => {
    try {
      await invoke("update_download_url", {
        downloadId: item.id,
        newUrl,
      });
      const updated = { ...item, url: newUrl };
      setDownloads((prev) => ({ ...prev, [item.id]: updated }));
      setRefreshItem(null);
      showNotification("Link address updated successfully");
      handleResume(updated);
    } catch (err: any) {
      console.error("Failed updating download URL:", err);
      showNotification(`Failed updating URL: ${err?.message || err}`);
    }
  };

  const handleOpenDetailsWindow = (item: DownloadItem) => {
    invoke("open_details_window", {
      downloadId: item.id,
      title: item.filename,
    }).catch((err) => console.error("Failed opening details window:", err));
  };

  const handleCancel = async (id: string) => {
    try {
      await invoke("cancel_download", { downloadId: id });
      setDownloads((prev) => {
        const item = prev[id];
        if (!item) return prev;
        return {
          ...prev,
          [id]: { ...item, status: "cancelled", speedBps: 0 },
        };
      });
      showNotification("Download cancelled");
    } catch (err: any) {
      console.error("Failed cancelling download:", err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await invoke("delete_download_history", { downloadId: id });
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectedItem?.id === id) setSelectedItem(null);
      if (detailsModalItem?.id === id) setDetailsModalItem(null);
      showNotification("Task removed from Rilo list");
    } catch (err: any) {
      console.error("Failed removing record:", err);
    }
  };

  const handleDeleteFileDisk = async (item: DownloadItem) => {
    try {
      await invoke("delete_download_file", {
        downloadId: item.id,
        filePath: item.savePath,
      });
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setDeleteModalItem(null);
      if (selectedItem?.id === item.id) setSelectedItem(null);
      if (detailsModalItem?.id === item.id) setDetailsModalItem(null);
      showNotification("Downloaded file deleted from disk");
    } catch (err: any) {
      console.error("Failed deleting file from disk:", err);
      showNotification(`Failed deleting file: ${err?.message || err}`);
    }
  };

  const handleOpenFile = async (savePath: string) => {
    try {
      await invoke("open_file", { path: savePath });
    } catch (err: any) {
      console.error("Failed opening file:", err);
      showNotification(`Failed to open file: ${err?.message || err}`);
    }
  };

  const handleOpenFolder = async (savePath: string) => {
    try {
      await invoke("open_folder_location", { path: savePath });
    } catch (err: any) {
      console.error("Failed opening folder:", err);
      showNotification(`Failed to open folder: ${err?.message || err}`);
    }
  };

  const handleClearCompleted = async () => {
    const completedItems = Object.values(downloads).filter(
      (i) => (i.status || "").toLowerCase() === "completed"
    );
    for (const item of completedItems) {
      try {
        await invoke("delete_download_history", { downloadId: item.id });
      } catch (err) {
        console.error("Failed clearing history item:", item.id, err);
      }
    }
    setDownloads((prev) => {
      const next: Record<string, DownloadItem> = {};
      Object.entries(prev).forEach(([id, item]) => {
        if ((item.status || "").toLowerCase() !== "completed") {
          next[id] = item;
        }
      });
      return next;
    });
    showNotification("Cleaned completed tasks from list");
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  const itemsList = Object.values(downloads);

  const filteredItems = itemsList.filter((item) => {
    const statusLower = (item.status || "").toLowerCase();
    let matchesCategory = true;
    if (activeTab === "downloading") {
      matchesCategory = statusLower === "downloading" || statusLower === "reconnecting" || statusLower === "restarting";
    } else if (activeTab === "paused") {
      matchesCategory = statusLower === "paused";
    } else if (activeTab === "completed") {
      matchesCategory = statusLower === "completed";
    } else if (activeTab !== "all") {
      matchesCategory = getCategoryFromFilename(item.filename) === activeTab;
    }

    let matchesSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      matchesSearch =
        item.filename.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.savePath.toLowerCase().includes(q);
    }

    return matchesCategory && matchesSearch;
  });

  const hasCompleted = itemsList.some((i) => (i.status || "").toLowerCase() === "completed");

  const statusCounts = {
    all: itemsList.length,
    downloading: itemsList.filter((i) => {
      const s = (i.status || "").toLowerCase();
      return s === "downloading" || s === "reconnecting" || s === "restarting";
    }).length,
    queued: itemsList.filter((i) => (i.status || "").toLowerCase() === "queued").length,
    paused: itemsList.filter((i) => (i.status || "").toLowerCase() === "paused").length,
    completed: itemsList.filter((i) => (i.status || "").toLowerCase() === "completed").length,
    failed: itemsList.filter((i) => {
      const s = (i.status || "").toLowerCase();
      return s === "error" || s === "failed" || s === "cancelled";
    }).length,
  };

  const categoryCounts = {
    Videos: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Videos").length,
    Music: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Music").length,
    Documents: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Documents").length,
    Programs: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Programs").length,
    Archives: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Archives").length,
    Images: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Images").length,
    Other: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "cat_Other").length,
  };

  const totalSpeedBps = itemsList.reduce((acc, i) => acc + (i.speedBps || 0), 0);

  return (
    <div className="h-screen w-screen bg-rilo-bg text-rilo-primary flex flex-col overflow-hidden font-sans select-none antialiased">
      <Toolbar
        selectedItem={selectedItem}
        hasCompleted={hasCompleted}
        onNewTask={() => setShowNewModal(true)}
        onPauseSelected={() => selectedItem && handlePause(selectedItem.id)}
        onResumeSelected={() => selectedItem && handleResume(selectedItem)}
        onCancelSelected={() => selectedItem && handleCancel(selectedItem.id)}
        onDeleteSelected={() => selectedItem && setDeleteModalItem(selectedItem)}
        onClearCompleted={handleClearCompleted}
        onOpenFolderSelected={() => selectedItem && handleOpenFolder(selectedItem.savePath)}
        onOpenDetailsSelected={() => selectedItem && setDetailsModalItem(selectedItem)}
        onOpenScheduler={() => setShowSchedulerModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          statusCounts={statusCounts}
          categoryCounts={categoryCounts}
          onOpenScheduler={() => setShowSchedulerModal(true)}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-rilo-bg overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <DownloadGrid
              items={filteredItems}
              selectedItem={selectedItem}
              onSelect={(item) => setSelectedItem(item)}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onRemove={handleRemove}
              onDeleteFileDisk={(item) => setDeleteModalItem(item)}
              onRefreshLink={setRefreshItem}
              onOpenDetails={(item) => setDetailsModalItem(item)}
            />
          </div>
        </main>
      </div>

      <StatusBar
        downloadingCount={statusCounts.downloading}
        totalSpeedBps={totalSpeedBps}
        queuedCount={statusCounts.queued}
        pausedCount={statusCounts.paused}
      />

      {notification && (
        <div className="fixed bottom-10 right-4 z-50 bg-rilo-elevated border border-rilo-border text-rilo-primary px-3.5 py-2 rounded-lg shadow-xl text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-rilo-accent animate-ping" />
          <span>{notification}</span>
        </div>
      )}

      {showNewModal && (
        <NewDownloadModal
          onClose={() => setShowNewModal(false)}
          onStartDownload={handleStartDownload}
        />
      )}

      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}

      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      {showSchedulerModal && (
        <SchedulerModal
          isOpen={showSchedulerModal}
          onClose={() => setShowSchedulerModal(false)}
        />
      )}

      {refreshItem && (
        <UpdateUrlModal
          item={refreshItem}
          onClose={() => setRefreshItem(null)}
          onUpdateUrl={handleUpdateUrl}
        />
      )}

      {/* Floating Download Details Inspector Window */}
      {detailsModalItem && (
        <DownloadDetailsModal
          item={detailsModalItem}
          onClose={() => setDetailsModalItem(null)}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onPause={handlePause}
          onResume={handleResume}
          onRemove={handleRemove}
          onDeleteFileDisk={(item) => setDeleteModalItem(item)}
          onRefreshLink={setRefreshItem}
        />
      )}

      {/* Download Completion Dialog */}
      {completionDialogItem && (
        <CompletionDialog
          item={completionDialogItem.item}
          action={completionDialogItem.action}
          onClose={() => setCompletionDialogItem(null)}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
        />
      )}

      {deleteModalItem && (
        <DeleteConfirmationModal
          item={deleteModalItem}
          onClose={() => setDeleteModalItem(null)}
          onConfirmDelete={() => handleDeleteFileDisk(deleteModalItem)}
        />
      )}
    </div>
  );
}
