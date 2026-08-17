import { useState, useEffect, useRef } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { normalizeUrl, isArchiveFilename, getFileNameFromUrl, formatBytes, getCategoryFromFilename } from "../utils";
import { DuplicateDownloadInfo, UrlMetadata } from "../types";
import { AppConfig } from "./SettingsModal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import DuplicateDownloadModal from "./DuplicateDownloadModal";
import {
  Plus,
  X,
  FolderOpen,
  Download,
  Archive,
  Clipboard,
  RefreshCw,
  Settings,
  LayoutGrid,
  Check,
  ChevronDown,
  Film,
  Music,
  FileText,
  Image,
  Package,
  Folder,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap
} from "lucide-preact";

interface NewDownloadModalProps {
  onClose: () => void;
  onStartDownload: (
    url: string,
    customPath: string,
    connections: number,
    queueOnly?: boolean,
    autoExtract?: boolean,
    extractDir?: string,
    deleteArchiveAfterExtract?: boolean,
    allowDuplicate?: boolean
  ) => void;
  onShowExisting?: (id: string) => void;
  onResumeExisting?: (id: string) => void;
}

const CATEGORIES = [
  { id: "Auto", name: "Auto Detect", icon: Sparkles },
  { id: "Programs", name: "Programs", icon: Package },
  { id: "Compressed", name: "Compressed", icon: Archive },
  { id: "Videos", name: "Videos", icon: Film },
  { id: "Music", name: "Music", icon: Music },
  { id: "Pictures", name: "Pictures", icon: Image },
  { id: "Documents", name: "Documents", icon: FileText },
  { id: "Other", name: "Other", icon: Folder },
];

export default function NewDownloadModal({
  onClose,
  onStartDownload,
  onShowExisting,
  onResumeExisting,
}: NewDownloadModalProps) {
  const [urlInput, setUrlInput] = useState("");
  const [customFilename, setCustomFilename] = useState("");
  const [userEditedFilename, setUserEditedFilename] = useState(false);
  const [userSelectedCategory, setUserSelectedCategory] = useState(false);
  const [baseDownloadDir, setBaseDownloadDir] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [useCategory, setUseCategory] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Auto");
  const [numConnections, setNumConnections] = useState<number>(8);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeSuccess, setProbeSuccess] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);

  // Duplicate / Conflict Modal State (Separate Overlay)
  const [conflictInfo, setConflictInfo] = useState<DuplicateDownloadInfo | null>(null);
  const [showConflictOverlay, setShowConflictOverlay] = useState(false);
  const [pendingQueueOnly, setPendingQueueOnly] = useState(false);

  // Advanced Settings Toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoExtract, setAutoExtract] = useState(false);
  const [extractDir, setExtractDir] = useState("");
  const [deleteAfterExtract, setDeleteAfterExtract] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const probeSeqRef = useRef<number>(0);

  // Load default download directory and settings on mount
  useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      try {
        const config = await invoke<AppConfig>("get_app_config");
        if (isMounted && config) {
          const baseDir = config.download.download_directory || "Downloads";
          setBaseDownloadDir(baseDir);
          setUseCategory(config.download.use_category_by_default !== false);
          setNumConnections(config.download.max_connections_per_download || 8);
          if (config.download.auto_extract_archives) {
            setAutoExtract(true);
          }
          if (config.download.delete_archive_after_extraction) {
            setDeleteAfterExtract(true);
          }
        }
      } catch (e) {
        console.warn("Failed loading config:", e);
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setShowCategoryMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Perform Live HEAD/Range Metadata Probe via Native Backend
  const performProbe = async (urlStr: string) => {
    const norm = normalizeUrl(urlStr);
    if (!norm) return;

    const currentSeq = ++probeSeqRef.current;
    setIsProbing(true);
    setProbeFailed(false);

    try {
      // 1. Fetch HTTP metadata (size, resolved filename, accept-ranges)
      const meta = await invoke<UrlMetadata>("fetch_url_metadata", { url: norm });
      if (probeSeqRef.current !== currentSeq) return;

      if (meta) {
        if (meta.size && meta.size > 0) {
          setFileSize(meta.size);
          setProbeSuccess(true);
        } else {
          setFileSize(null);
          setProbeSuccess(false);
          setProbeFailed(true);
        }

        if (meta.filename && !userEditedFilename) {
          setCustomFilename(meta.filename);
        }
      }

      // 2. Check for duplicate download
      const dup = await invoke<DuplicateDownloadInfo | null>("check_duplicate_download", { url: norm });
      if (probeSeqRef.current !== currentSeq) return;

      if (dup) {
        setConflictInfo(dup);
        if (!meta?.size && dup.total_bytes > 0) {
          setFileSize(dup.total_bytes);
          setProbeSuccess(true);
        }
      } else {
        setConflictInfo(null);
        setShowConflictOverlay(false);
      }
    } catch (e: any) {
      if (probeSeqRef.current !== currentSeq) return;
      console.warn("Probe URL error:", e);
      setProbeFailed(true);
      setProbeSuccess(false);
    } finally {
      if (probeSeqRef.current === currentSeq) {
        setIsProbing(false);
      }
    }
  };

  // URL Input Change handler with debounce
  useEffect(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setCustomFilename("");
      setUserEditedFilename(false);
      setUserSelectedCategory(false);
      setFileSize(null);
      setProbeSuccess(false);
      setProbeFailed(false);
      setConflictInfo(null);
      setShowConflictOverlay(false);
      return;
    }

    if (!userEditedFilename) {
      const defaultName = getFileNameFromUrl(trimmed);
      if (defaultName) {
        setCustomFilename(defaultName);
      }
    }

    const timeout = setTimeout(() => {
      performProbe(trimmed);
    }, 300);

    return () => clearTimeout(timeout);
  }, [urlInput]);

  // Derived effective filename and category
  const effectiveFilename = customFilename.trim() || (urlInput.trim() ? getFileNameFromUrl(urlInput.trim()) : "");
  const detectedCategory = effectiveFilename ? getCategoryFromFilename(effectiveFilename) : "Other";
  const effectiveCategory = selectedCategory === "Auto" ? detectedCategory : selectedCategory;

  // Compute destination save path based on category selection
  useEffect(() => {
    if (!baseDownloadDir) return;
    const cleanBase = baseDownloadDir.replace(/[/\\]+$/, "");
    if (useCategory && effectiveCategory) {
      const sep = cleanBase.includes("/") ? "/" : "\\";
      const lowerBase = cleanBase.toLowerCase();
      const riloSub = lowerBase.endsWith("rilo") ? "" : `${sep}Rilo`;
      setCustomPath(`${cleanBase}${riloSub}${sep}${effectiveCategory}`);
    } else {
      setCustomPath(cleanBase);
    }
  }, [baseDownloadDir, useCategory, effectiveCategory]);

  // 100 MB Test button action
  const handleLoad100MbTest = () => {
    const testUrl = "https://ash-speed.hetzner.com/100MB.bin";
    setUserEditedFilename(false);
    setUserSelectedCategory(false);
    setUrlInput(testUrl);
    setCustomFilename("100MB.bin");
    setSelectedCategory("Auto");
    setInfoMsg("Loaded 100 MB Hetzner Test URL");
    setErrorMsg(null);
    performProbe(testUrl);
  };

  // Paste from clipboard action
  const handlePasteFromClipboard = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setErrorMsg("Unable to read clipboard");
        return;
      }

      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setErrorMsg("No URL found in clipboard");
        return;
      }

      const urlMatch = text.match(/https?:\/\/[^\s"'<>\`]+/i);
      if (!urlMatch) {
        setErrorMsg("No URL found in clipboard");
        return;
      }

      const extractedUrl = urlMatch[0].trim().replace(/[.,;!)]+$/, "");
      const normalized = normalizeUrl(extractedUrl);

      if (normalized) {
        setUserEditedFilename(false);
        setUserSelectedCategory(false);
        setUrlInput(normalized);
        setInfoMsg("URL pasted from clipboard");
        performProbe(normalized);
      } else {
        setErrorMsg("No valid URL found in clipboard");
      }
    } catch (err) {
      console.warn("Clipboard read error:", err);
      setErrorMsg("Unable to read clipboard");
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showConflictOverlay) {
          setShowConflictOverlay(false);
        } else if (showCategoryMenu) {
          setShowCategoryMenu(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showConflictOverlay, showCategoryMenu]);

  const handleBrowseFolder = async () => {
    try {
      setErrorMsg(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Base Save Directory",
        defaultPath: baseDownloadDir || undefined,
      });
      if (selected && typeof selected === "string") {
        setBaseDownloadDir(selected);
      }
    } catch (err: any) {
      console.error("Folder picker error:", err);
      setErrorMsg(`Folder picker failed: ${err?.message || err}`);
    }
  };

  const handleBrowseExtractFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Extraction Directory",
      });
      if (selected && typeof selected === "string") {
        setExtractDir(selected);
      }
    } catch (err: any) {
      console.error("Extract folder picker error:", err);
    }
  };

  const handleSubmit = (queueOnly = false, forceDownloadAnyway = false) => {
    setErrorMsg(null);
    const rawUrl = urlInput.trim();
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) {
      setErrorMsg("Please enter a valid URL address");
      return;
    }

    // If duplicate detected and not forced, open the separate conflict overlay modal
    if (conflictInfo && !forceDownloadAnyway) {
      setPendingQueueOnly(queueOnly);
      setShowConflictOverlay(true);
      return;
    }

    const sep = customPath.includes("/") ? "/" : "\\";
    let finalSavePath = customPath.trim();
    let finalFilename = customFilename.trim() || getFileNameFromUrl(normalized);

    if (forceDownloadAnyway && conflictInfo) {
      const dotIdx = finalFilename.lastIndexOf(".");
      if (dotIdx > 0) {
        finalFilename = `${finalFilename.substring(0, dotIdx)} (1)${finalFilename.substring(dotIdx)}`;
      } else {
        finalFilename = `${finalFilename} (1)`;
      }
    }

    if (finalSavePath && !finalSavePath.endsWith(finalFilename)) {
      finalSavePath = `${finalSavePath}${sep}${finalFilename}`;
    }

    try {
      onStartDownload(
        normalized,
        finalSavePath,
        numConnections,
        queueOnly,
        autoExtract,
        extractDir.trim(),
        deleteAfterExtract,
        forceDownloadAnyway
      );
      onClose();
    } catch (err: any) {
      console.error("Task submission error:", err);
      setErrorMsg(`Failed to start download: ${err?.message || err}`);
    }
  };

  const isArchive = isArchiveFilename(customFilename) || isArchiveFilename(urlInput);
  const activeCategoryObj = (() => {
    if (selectedCategory === "Auto") {
      const matched = CATEGORIES.find((c) => c.id === detectedCategory);
      return {
        id: "Auto",
        name: effectiveFilename ? `Auto Detect (${detectedCategory})` : "Auto Detect",
        icon: matched ? matched.icon : Sparkles,
      };
    }
    return CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  })();
  const CategoryIcon = activeCategoryObj.icon;
  const isUrlValid = Boolean(urlInput.trim() && normalizeUrl(urlInput.trim()));

  return (
    <>
      <div className="fixed inset-0 z-50 bg-rilo-overlay backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-150">
        <div className="bg-rilo-surface border border-rilo-border rounded-xl w-[520px] max-w-[95vw] rilo-modal-shadow overflow-hidden flex flex-col font-sans text-rilo-primary">
          {/* Titlebar Header */}
          <div className="bg-rilo-surface border-b border-rilo-border px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-6 h-6 rounded bg-rilo-elevated border border-rilo-border text-rilo-accent flex items-center justify-center">
                <Download className="w-3.5 h-3.5 text-rilo-accent" />
              </div>
              <h3 className="text-xs font-bold text-rilo-primary tracking-wide">
                Add Download
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleLoad100MbTest}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-rilo-elevated border border-rilo-border text-rilo-accent hover:bg-rilo-surface hover:border-rilo-accent transition-all duration-100 cursor-pointer flex items-center space-x-1 active:scale-95 shadow-xs"
                title="Load 100 MB Hetzner speed test URL"
              >
                <Zap className="w-3 h-3 text-rilo-accent" />
                <span>100 MB Test</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-all duration-100 rounded cursor-pointer active:scale-95"
                title="Close (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form Body */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(false);
            }}
            className="p-4 space-y-3 text-xs bg-rilo-surface"
          >
            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-rose-400 text-[11px] flex items-center space-x-2 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-400 text-[11px] font-semibold flex items-center space-x-2 animate-in fade-in">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* 1. URL Input Row with Paste Icon */}
            <div className="relative">
              <input
                type="text"
                placeholder="https://..."
                value={urlInput}
                onInput={(e) => {
                  setUrlInput((e.target as HTMLInputElement).value);
                  setInfoMsg(null);
                  setErrorMsg(null);
                }}
                className="w-full pl-3 pr-10 py-2 text-xs bg-rilo-elevated border border-rilo-border rounded-lg text-rilo-primary placeholder-rilo-muted focus:outline-none focus:border-rilo-accent transition-colors font-mono"
              />
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="absolute right-2 top-2 p-1 text-rilo-muted hover:text-rilo-primary hover:bg-rilo-surface rounded transition-all duration-100 cursor-pointer active:scale-90"
                title="Paste from clipboard"
              >
                <Clipboard className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Category Selector & File Size Row */}
            <div className="flex items-center justify-between gap-2">
              {/* Category Toggle & Dropdown */}
              <div className="flex items-center space-x-2 flex-1 min-w-0" ref={categoryMenuRef}>
                <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-medium text-rilo-primary shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={useCategory}
                    onChange={(e) => setUseCategory((e.target as HTMLInputElement).checked)}
                    className="rounded border-rilo-border text-rilo-accent focus:ring-rilo-accent w-4 h-4 cursor-pointer"
                  />
                  <span>Use Category</span>
                </label>

                {/* Category Dropdown Button */}
                <div className="relative flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                    disabled={!useCategory}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs bg-rilo-elevated border border-rilo-border rounded-lg text-rilo-primary hover:border-rilo-border-strong hover:bg-rilo-surface transition-all duration-100 cursor-pointer active:scale-[0.98] ${
                      !useCategory ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <CategoryIcon className="w-3.5 h-3.5 text-rilo-accent flex-shrink-0" />
                      <span className="truncate">{activeCategoryObj.name}</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-rilo-muted ml-1 flex-shrink-0 transition-transform duration-150 ${showCategoryMenu ? "rotate-180" : ""}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showCategoryMenu && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-rilo-elevated border border-rilo-border rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100 divide-y divide-rilo-border/40">
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        const displayName =
                          cat.id === "Auto"
                            ? (effectiveFilename ? `Auto Detect (${detectedCategory})` : "Auto Detect")
                            : cat.name;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              if (cat.id === "Auto") {
                                setSelectedCategory("Auto");
                                setUserSelectedCategory(false);
                              } else {
                                setSelectedCategory(cat.id);
                                setUserSelectedCategory(true);
                              }
                              setShowCategoryMenu(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center space-x-2.5 hover:bg-rilo-surface transition-all duration-100 cursor-pointer active:scale-[0.98] ${
                              isSelected ? "text-rilo-accent font-bold bg-rilo-surface/60" : "text-rilo-primary"
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-rilo-accent" : "text-rilo-muted"}`} />
                            <span className="flex-1">{displayName}</span>
                            {isSelected && <Check className="w-3 h-3 text-rilo-accent shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setUseCategory(true)}
                  className="w-8 h-8 rounded-lg bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-surface flex items-center justify-center transition-all duration-100 cursor-pointer shrink-0 active:scale-90"
                  title="Use category directory"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* File Size Display */}
              <div className="flex items-center space-x-2 pl-3 border-l border-rilo-border/60 shrink-0">
                <div className="flex flex-col items-end min-w-[84px]">
                  <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-rilo-primary">
                    <LayoutGrid className="w-3.5 h-3.5 text-rilo-accent shrink-0" />
                    {isProbing ? (
                      <span className="flex items-center space-x-1 text-rilo-muted font-normal">
                        <Loader2 className="w-3 h-3 animate-spin text-rilo-accent" />
                        <span>Fetching...</span>
                      </span>
                    ) : fileSize && fileSize > 0 ? (
                      <span className="text-rilo-primary">{formatBytes(fileSize)}</span>
                    ) : probeFailed ? (
                      <span className="text-rilo-muted font-normal text-[11px]">Unknown size</span>
                    ) : (
                      <span className="text-rilo-muted font-normal">-- MB</span>
                    )}
                  </div>

                  {probeSuccess && (
                    <div className="flex items-center space-x-1 text-[10px] text-emerald-400 font-semibold leading-none pt-0.5 animate-in fade-in">
                      <Check className="w-3 h-3" />
                      <span>verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Save Directory Path with Browse & Settings Actions */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center w-full px-3 py-1.5 text-xs bg-rilo-elevated border border-rilo-border rounded-lg text-rilo-primary">
                  <Folder className="w-4 h-4 text-rilo-accent mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    value={customPath}
                    onInput={(e) => {
                      setCustomPath((e.target as HTMLInputElement).value);
                      setUseCategory(false);
                    }}
                    className="w-full bg-transparent text-xs text-rilo-primary focus:outline-none font-mono truncate"
                    placeholder="Save folder..."
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="ml-2 text-rilo-muted hover:text-rilo-primary hover:bg-rilo-surface p-0.5 rounded transition-all duration-100 cursor-pointer active:scale-90"
                    title="Browse folder"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Tools on Right */}
              <button
                type="button"
                onClick={() => performProbe(urlInput)}
                className="w-8 h-8 rounded-lg bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-surface flex items-center justify-center transition-all duration-100 cursor-pointer shrink-0 active:scale-90"
                title="Refresh / Re-probe URL"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? "animate-spin text-rilo-accent" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-100 cursor-pointer shrink-0 active:scale-90 ${
                  showAdvanced
                    ? "bg-rilo-selected border-rilo-accent text-rilo-accent"
                    : "bg-rilo-elevated border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-surface"
                }`}
                title="Advanced Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4. Filename Input Box & Conflict Warning Pill */}
            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Filename..."
                  value={customFilename}
                  onInput={(e) => {
                    setUserEditedFilename(true);
                    setCustomFilename((e.target as HTMLInputElement).value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-rilo-elevated border border-rilo-border rounded-lg text-rilo-primary font-mono focus:outline-none focus:border-rilo-accent transition-colors pr-24"
                />
                {conflictInfo && (
                  <button
                    type="button"
                    onClick={() => setShowConflictOverlay(true)}
                    className="absolute right-2 px-2 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer flex items-center space-x-1"
                    title="Click to view existing download options"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span>Already in list</span>
                  </button>
                )}
              </div>
            </div>

            {/* 5. Advanced Options (Collapsible) */}
            {showAdvanced && (
              <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-rilo-secondary">Connection Threads</label>
                  <select
                    value={numConnections}
                    onChange={(e) => setNumConnections(Number((e.target as HTMLSelectElement).value))}
                    className="bg-rilo-surface border border-rilo-border rounded px-2 py-1 text-xs text-rilo-primary font-mono"
                  >
                    <option value={1}>1 Thread (Single Stream)</option>
                    <option value={4}>4 Threads (Standard)</option>
                    <option value={8}>8 Threads (Optimal / Balanced)</option>
                    <option value={16}>16 Threads (High Speed)</option>
                    <option value={32}>32 Threads (Max Performance)</option>
                  </select>
                </div>

                {isArchive && (
                  <div className="pt-2 border-t border-rilo-border/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rilo-primary text-[11px]">Auto Extract</span>
                      <input
                        type="checkbox"
                        checked={autoExtract}
                        onChange={(e) => setAutoExtract((e.target as HTMLInputElement).checked)}
                        className="rounded border-rilo-border text-rilo-accent w-4 h-4 cursor-pointer"
                      />
                    </div>

                    {autoExtract && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center space-x-2">
                          <Input
                            type="text"
                            placeholder="Extract directory..."
                            value={extractDir}
                            onInput={(e) => setExtractDir((e.target as HTMLInputElement).value)}
                            className="flex-1 py-1 text-[11px]"
                          />
                          <Button type="button" variant="outline" size="sm" onClick={handleBrowseExtractFolder}>
                            <FolderOpen className="w-3 h-3" />
                          </Button>
                        </div>
                        <label className="flex items-center space-x-1.5 text-[10px] text-rilo-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deleteAfterExtract}
                            onChange={(e) => setDeleteAfterExtract((e.target as HTMLInputElement).checked)}
                            className="rounded border-rilo-border text-rilo-accent w-3.5 h-3.5"
                          />
                          <span>Delete archive file after extraction</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 6. Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-rilo-border">
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSubmit(true)}
                  disabled={!isUrlValid}
                  className="text-xs h-8 px-3.5"
                >
                  Add
                </Button>

                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={!isUrlValid}
                  className="text-xs h-8 px-4 font-semibold"
                >
                  Download
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="text-xs h-8 px-4"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Separate Conflict Resolution Modal Overlay */}
      {showConflictOverlay && conflictInfo && (
        <DuplicateDownloadModal
          duplicate={conflictInfo}
          onClose={() => setShowConflictOverlay(false)}
          onResume={(id) => {
            setShowConflictOverlay(false);
            if (onResumeExisting) onResumeExisting(id);
            onClose();
          }}
          onShowExisting={(id) => {
            setShowConflictOverlay(false);
            if (onShowExisting) onShowExisting(id);
            onClose();
          }}
          onDownloadAnyway={() => {
            setShowConflictOverlay(false);
            handleSubmit(pendingQueueOnly, true);
          }}
        />
      )}
    </>
  );
}
