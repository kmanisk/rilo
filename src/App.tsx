import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit, UnlistenFn } from "@tauri-apps/api/event";
import { DownloadItem, DownloadProgressPayload, DownloadRecord, DuplicateDownloadInfo, ExtractionProgressPayload } from "./types";
import { getCategoryFromFilename } from "./utils";
import { applyExtractionProgress, progressToDownloadItem, recordToDownloadItem } from "./lib/downloads/mapping";
import { normalizeDownloadStatus } from "./lib/downloads/status";
import { applyVisualSettings, applyUiScaleWindow, AppearanceSettings } from "./lib/settings/visual";
import { openDownloadDetailsWindow, openCompletionWindow, openTestWindow } from "./lib/windows";

import CustomTitleBar from "./components/CustomTitleBar";
import Toolbar from "./components/Toolbar";
import Sidebar, { CategoryTab } from "./components/Sidebar";
import DownloadGrid from "./components/DownloadGrid";
import StatusBar from "./components/StatusBar";
import NewDownloadModal from "./components/NewDownloadModal";
import UpdateUrlModal from "./components/UpdateUrlModal";
import AboutModal from "./components/AboutModal";
import SchedulerModal from "./components/SchedulerModal";
import DeleteConfirmationModal from "./components/DeleteConfirmationModal";
import DuplicateDownloadModal from "./components/DuplicateDownloadModal";
import { SettingsModal, AppConfig } from "./components/SettingsModal";

export default function App() {
  const [downloads, setDownloads] = useState<Record<string, DownloadItem>>({});
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<DownloadItem | null>(null);
  const [refreshItem, setRefreshItem] = useState<DownloadItem | null>(null);
  const [deleteModalItem, setDeleteModalItem] = useState<DownloadItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState<string>("luna-xp");
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [showNewModal, setShowNewModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [duplicateModalInfo, setDuplicateModalInfo] = useState<DuplicateDownloadInfo | null>(null);
  const [pendingDownloadArgs, setPendingDownloadArgs] = useState<{
    url: string;
    customPath?: string;
    connections?: number;
    autoExtract?: boolean;
    extractDir?: string;
    deleteArchiveAfterExtract?: boolean;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const completedTrackedRef = useRef<Set<string>>(new Set());

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings | null>(null);
  const activeAppearanceRef = useRef<AppearanceSettings | null>(null);

  const handleSelectTheme = async (themeId: string) => {
    try {
      setCurrentThemeId(themeId);
      const appConfig = await invoke<AppConfig>("get_app_config");
      const updatedConfig: AppConfig = {
        ...appConfig,
        appearance: {
          ...appConfig.appearance,
          theme: themeId,
        },
      };
      activeAppearanceRef.current = updatedConfig.appearance;
      setAppearanceSettings(updatedConfig.appearance);
      applyVisualSettings(updatedConfig.appearance);
      applyUiScaleWindow(updatedConfig.appearance.ui_scale);
      await invoke("update_app_config", { config: updatedConfig });
      emit("rilo-appearance-changed", updatedConfig.appearance).catch(() => {});
      showNotification("Theme updated successfully");
    } catch (err) {
      console.error("Error updating theme:", err);
    }
  };

  // Load Appearance & Typography settings from persistent AppData AppConfig on startup
  useEffect(() => {
    async function initAppearance() {
      try {
        const appConfig = await invoke<AppConfig>("get_app_config");
        activeAppearanceRef.current = appConfig.appearance;
        setAppearanceSettings(appConfig.appearance);
        applyVisualSettings(appConfig.appearance);
        applyUiScaleWindow(appConfig.appearance.ui_scale);
        if (appConfig.appearance.theme) {
          setCurrentThemeId(appConfig.appearance.theme);
        }
      } catch (err) {
        console.error("Error loading Rilo app config:", err);
      }
    }
    initAppearance();

    let unlisten: (() => void) | undefined;
    listen<AppearanceSettings>("rilo-appearance-changed", (event) => {
      if (event.payload) {
        activeAppearanceRef.current = event.payload;
        setAppearanceSettings(event.payload);
        if (event.payload.theme) {
          setCurrentThemeId(event.payload.theme);
        }
        applyVisualSettings(event.payload);
        applyUiScaleWindow(event.payload.ui_scale);
      }
    }).then((un) => { unlisten = un; }).catch(() => {});

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
      if (unlisten) unlisten();
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemChange);
      } else {
        mediaQuery.removeListener(handleSystemChange);
      }
    };
  }, []);

  // Listen for search focus and settings toggle events from global shortcut interceptor
  useEffect(() => {
    const handleFocusSearch = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    };
    const handleToggleSettings = () => {
      setShowSettingsModal((prev) => !prev);
    };

    window.addEventListener("rilo:focus-search", handleFocusSearch);
    window.addEventListener("rilo:toggle-settings", handleToggleSettings);
    return () => {
      window.removeEventListener("rilo:focus-search", handleFocusSearch);
      window.removeEventListener("rilo:toggle-settings", handleToggleSettings);
    };
  }, []);

  // Load history from SQLite DB on startup
  useEffect(() => {
    async function loadHistory() {
      try {
        const records = await invoke<DownloadRecord[]>("get_download_history");
        const historyMap: Record<string, DownloadItem> = {};
        records.forEach((rec) => {
          const item = recordToDownloadItem(rec);

          if (item.status === "completed") {
            completedTrackedRef.current.add(rec.id);
          }

          historyMap[rec.id] = item;
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
            const statusLower = normalizeDownloadStatus(payload.status);

            setDownloads((prev) => {
              const updatedItem = progressToDownloadItem(payload, prev[payload.download_id]);

              if (statusLower === "completed" && !completedTrackedRef.current.has(payload.download_id)) {
                completedTrackedRef.current.add(payload.download_id);
                showNotification(`Download completed: ${updatedItem.filename}`);
                openCompletionWindow(payload.download_id, updatedItem.filename);
              }

              setSelectedItem((current) => {
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

              const updatedItem = applyExtractionProgress(existing, payload);

              setSelectedItem((current) => {
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
    deleteArchiveAfterExtract = false,
    allowDuplicate = false
  ) => {
    try {
      const record = await invoke<DownloadRecord>("start_download", {
        url,
        customPath: customPath || null,
        numConnections: connections || 4,
        allowDuplicate,
      });

      const newItem = recordToDownloadItem(record);
      newItem.autoExtract = autoExtract;
      newItem.extractDir = extractDir;
      newItem.deleteArchiveAfterExtract = deleteArchiveAfterExtract;

      setDownloads((prev) => ({ ...prev, [record.id]: newItem }));
      setSelectedItem(newItem);

      if (autoExtract || extractDir || deleteArchiveAfterExtract) {
        await invoke("update_download_extraction_config", {
          downloadId: record.id,
          autoExtract,
          extractDir: extractDir || null,
          deleteAfter: deleteArchiveAfterExtract,
        });
      }

      showNotification("Download task started");
    } catch (err: any) {
      const errMsg = String(err?.message || err || "");
      if (errMsg.startsWith("DUPLICATE:")) {
        try {
          const dupInfo: DuplicateDownloadInfo = JSON.parse(errMsg.substring("DUPLICATE:".length));
          setDuplicateModalInfo(dupInfo);
          setPendingDownloadArgs({
            url,
            customPath,
            connections,
            autoExtract,
            extractDir,
            deleteArchiveAfterExtract,
          });
          return;
        } catch (parseErr) {
          console.error("Failed to parse duplicate info:", parseErr);
        }
      }
      console.error("Failed starting download:", err);
      showNotification(`Error: ${errMsg}`);
    }
  };

  const handleDownloadAnyway = () => {
    if (pendingDownloadArgs) {
      const args = pendingDownloadArgs;
      setPendingDownloadArgs(null);
      setDuplicateModalInfo(null);
      handleStartDownload(
        args.url,
        args.customPath,
        args.connections,
        false,
        args.autoExtract,
        args.extractDir,
        args.deleteArchiveAfterExtract,
        true // allowDuplicate
      );
    }
  };

  const handleShowExistingDuplicate = (id: string) => {
    const existing = downloads[id];
    if (existing) {
      setSelectedItem(existing);
      showNotification(`Viewing existing download: ${existing.filename}`);
    }
    setDuplicateModalInfo(null);
    setPendingDownloadArgs(null);
  };

  const handleResumeExistingDuplicate = (id: string) => {
    const existing = downloads[id];
    if (existing) {
      handleResume(existing);
    }
    setDuplicateModalInfo(null);
    setPendingDownloadArgs(null);
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

  const handleOpenDetailsWindow = async (downloadId: string, title?: string) => {
    const existing = downloads[downloadId];
    if (!existing) {
      showNotification("Download is no longer available");
      return;
    }

    try {
      const records = await invoke<DownloadRecord[]>("get_download_history");
      const found = records.some((r) => r.id === downloadId);
      if (!found) {
        showNotification("Download is no longer available");
        return;
      }
    } catch (err) {
      console.warn("Record DB validation check error:", err);
    }

    try {
      await openDownloadDetailsWindow(downloadId, title || existing.filename);
    } catch (err) {
      showNotification("Download is no longer available");
    }
  };

  const handleOpenTestWindow = () => {
    openTestWindow();
  };

  useEffect(() => {
    let unlistenTest: UnlistenFn | undefined;
    listen<{ message: string }>("rilo-test-event", () => showNotification("Received event from test window"))
      .then((stop) => { unlistenTest = stop; });
    return () => unlistenTest?.();
  }, []);

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
      showNotification("Task removed from Rilo list");
    } catch (err: any) {
      console.error("Failed removing record:", err);
    }
  };

  const handleDeleteFileDisk = async (item: DownloadItem) => {
    try {
      await invoke("delete_download_file", {
        downloadId: item.id,
      });
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setDeleteModalItem(null);
      if (selectedItem?.id === item.id) setSelectedItem(null);
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
      (i) => normalizeDownloadStatus(i.status) === "completed"
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
        if (normalizeDownloadStatus(item.status) !== "completed") {
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
    const statusLower = normalizeDownloadStatus(item.status);
    let matchesCategory = true;
    if (activeTab === "downloading") {
      matchesCategory = statusLower === "downloading" || statusLower === "reconnecting" || statusLower === "restarting";
    } else if (activeTab === "paused") {
      matchesCategory = statusLower === "paused";
    } else if (activeTab === "completed") {
      matchesCategory = statusLower === "completed";
    } else if (activeTab !== "all") {
      const cat = getCategoryFromFilename(item.filename);
      matchesCategory =
        activeTab === `cat_${cat}` ||
        (activeTab === "cat_Archives" && cat === "Compressed") ||
        (activeTab === "cat_Images" && cat === "Pictures");
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

  // Desktop & Vim-Style Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      // Global Shortcuts: Ctrl+F, Ctrl+,, Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "," || e.code === "Comma")) {
        e.preventDefault();
        setShowSettingsModal((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowNewModal(true);
        return;
      }

      // If an input is currently focused, do not trigger single-key list shortcuts
      if (isInput) return;

      // Do not trigger list shortcuts if any modal is currently open
      const isModalOpen =
        showNewModal ||
        showSettingsModal ||
        showAboutModal ||
        showSchedulerModal ||
        !!deleteModalItem ||
        !!duplicateModalInfo;

      if (isModalOpen) return;

      // Vim / List Shortcuts
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        if (!selectedItem) {
          setSelectedItem(filteredItems[0]);
        } else {
          const currentIndex = filteredItems.findIndex((item) => item.id === selectedItem.id);
          if (currentIndex === -1) {
            setSelectedItem(filteredItems[0]);
          } else if (currentIndex < filteredItems.length - 1) {
            setSelectedItem(filteredItems[currentIndex + 1]);
          }
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        if (!selectedItem) {
          setSelectedItem(filteredItems[filteredItems.length - 1]);
        } else {
          const currentIndex = filteredItems.findIndex((item) => item.id === selectedItem.id);
          if (currentIndex === -1) {
            setSelectedItem(filteredItems[filteredItems.length - 1]);
          } else if (currentIndex > 0) {
            setSelectedItem(filteredItems[currentIndex - 1]);
          }
        }
      } else if (e.key === "Escape") {
        if (selectedItem) {
          e.preventDefault();
          setSelectedItem(null);
        }
      } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        showNotification("Shortcuts: j/k=Navigate | Enter=Open/Details | p=Pause | r=Resume | d=Delete | c=Cancel | Space=Toggle");
      } else if (selectedItem) {
        const statusLower = normalizeDownloadStatus(selectedItem.status);

        if (e.key === "Enter") {
          e.preventDefault();
          if (statusLower === "completed") {
            handleOpenFile(selectedItem.savePath);
          } else {
            handleOpenDetailsWindow(selectedItem.id, selectedItem.filename);
          }
        } else if (e.key === "d" || e.key === "Delete") {
          e.preventDefault();
          handleRemove(selectedItem.id);
        } else if (e.key === "p") {
          e.preventDefault();
          if (statusLower === "downloading" || statusLower === "reconnecting") {
            handlePause(selectedItem.id);
          }
        } else if (e.key === "r") {
          e.preventDefault();
          if (statusLower === "paused" || statusLower === "queued" || statusLower === "error" || statusLower === "cancelled") {
            handleResume(selectedItem);
          }
        } else if (e.key === "c") {
          e.preventDefault();
          if (statusLower === "downloading" || statusLower === "queued" || statusLower === "paused" || statusLower === "reconnecting") {
            handleCancel(selectedItem.id);
          }
        } else if (e.code === "Space") {
          e.preventDefault();
          if (statusLower === "downloading" || statusLower === "reconnecting") {
            handlePause(selectedItem.id);
          } else if (statusLower === "paused" || statusLower === "queued" || statusLower === "error") {
            handleResume(selectedItem);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredItems,
    selectedItem,
    showNewModal,
    showSettingsModal,
    showAboutModal,
    showSchedulerModal,
    deleteModalItem,
    duplicateModalInfo,
  ]);

  const hasCompleted = itemsList.some((i) => normalizeDownloadStatus(i.status) === "completed");

  const statusCounts = {
    all: itemsList.length,
    downloading: itemsList.filter((i) => {
      const s = normalizeDownloadStatus(i.status);
      return s === "downloading" || s === "reconnecting" || s === "restarting";
    }).length,
    queued: itemsList.filter((i) => normalizeDownloadStatus(i.status) === "queued").length,
    paused: itemsList.filter((i) => normalizeDownloadStatus(i.status) === "paused").length,
    completed: itemsList.filter((i) => normalizeDownloadStatus(i.status) === "completed").length,
    failed: itemsList.filter((i) => {
      const s = normalizeDownloadStatus(i.status);
      return s === "error" || s === "cancelled";
    }).length,
  };

  const categoryCounts = {
    Compressed: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Compressed").length,
    Programs: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Programs").length,
    Videos: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Videos").length,
    Music: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Music").length,
    Pictures: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Pictures").length,
    Documents: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Documents").length,
    Other: itemsList.filter((i) => getCategoryFromFilename(i.filename) === "Other").length,
  };

  const totalSpeedBps = itemsList.reduce((acc, i) => acc + (i.speedBps || 0), 0);

  return (
    <div className="h-screen w-screen bg-rilo-bg text-rilo-primary flex flex-col overflow-hidden font-sans select-none antialiased">
      {/* 1. Custom Frameless Title Bar with Menus & Search */}
      <CustomTitleBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        onNewTask={() => setShowNewModal(true)}
        onOpenFolderSelected={() => selectedItem && handleOpenFolder(selectedItem.savePath)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenScheduler={() => setShowSchedulerModal(true)}
        onOpenAbout={() => setShowAboutModal(true)}
        onClearCompleted={handleClearCompleted}
        onResumeSelected={() => selectedItem && handleResume(selectedItem)}
        onPauseSelected={() => selectedItem && handlePause(selectedItem.id)}
        onCancelSelected={() => selectedItem && handleCancel(selectedItem.id)}
        onDeleteSelected={() => selectedItem && setDeleteModalItem(selectedItem)}
        currentThemeId={currentThemeId}
        onSelectTheme={handleSelectTheme}
        compactTopBar={appearanceSettings?.compact_top_bar !== false}
      />

      {/* 2. Dense Command Toolbar */}
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
        onOpenDetailsSelected={() => selectedItem && handleOpenDetailsWindow(selectedItem.id, selectedItem.filename)}
        onOpenScheduler={() => setShowSchedulerModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenTestWindow={handleOpenTestWindow}
        showIconLabels={appearanceSettings?.show_icon_labels !== false}
      />

      {/* 3. Main Body Split: Sidebar + Download Table */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          statusCounts={statusCounts}
          categoryCounts={categoryCounts}
          onOpenScheduler={() => setShowSchedulerModal(true)}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-rilo-bg overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
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
              onOpenDetails={(item) => handleOpenDetailsWindow(item.id, item.filename)}
              onOpenDetailsWindow={(item) => handleOpenDetailsWindow(item.id, item.filename)}
              onNewTask={() => setShowNewModal(true)}
              useRelativeDateTime={appearanceSettings?.use_relative_date_time !== false}
            />
          </div>
        </main>
      </div>

      {/* 4. Bottom Status Bar */}
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
          onShowExisting={handleShowExistingDuplicate}
          onResumeExisting={handleResumeExistingDuplicate}
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

      {deleteModalItem && (
        <DeleteConfirmationModal
          item={deleteModalItem}
          onClose={() => setDeleteModalItem(null)}
          onConfirmDelete={() => handleDeleteFileDisk(deleteModalItem)}
        />
      )}

      {duplicateModalInfo && (
        <DuplicateDownloadModal
          duplicate={duplicateModalInfo}
          onClose={() => {
            setDuplicateModalInfo(null);
            setPendingDownloadArgs(null);
          }}
          onResume={handleResumeExistingDuplicate}
          onShowExisting={handleShowExistingDuplicate}
          onDownloadAnyway={handleDownloadAnyway}
        />
      )}
    </div>
  );
}
