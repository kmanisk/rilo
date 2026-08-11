import { useState, useEffect, useRef } from "preact/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X, Search, ChevronRight, Check } from "lucide-preact";
import { riloThemes } from "../lib/themes/themes";

interface CustomTitleBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: { current: HTMLInputElement | null };
  onNewTask: () => void;
  onOpenFolderSelected: () => void;
  onOpenSettings: () => void;
  onOpenScheduler: () => void;
  onOpenAbout: () => void;
  onClearCompleted: () => void;
  onResumeSelected: () => void;
  onPauseSelected: () => void;
  onCancelSelected: () => void;
  onDeleteSelected: () => void;
  currentThemeId?: string;
  onSelectTheme?: (themeId: string) => void;
}

export default function CustomTitleBar({
  searchQuery,
  onSearchChange,
  searchInputRef,
  onNewTask,
  onOpenFolderSelected,
  onOpenSettings,
  onOpenScheduler,
  onOpenAbout,
  onClearCompleted,
  onResumeSelected,
  onPauseSelected,
  onCancelSelected,
  onDeleteSelected,
  currentThemeId,
  onSelectTheme,
}: CustomTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuKeys = ["file", "tasks", "tools", "theme", "help"];

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized).catch(() => {});

    let unlisten: (() => void) | undefined;
    win
      .onResized(() => {
        win.isMaximized().then(setIsMaximized).catch(() => {});
      })
      .then((cb) => (unlisten = cb))
      .catch(() => {});

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setOpenSubmenu(null);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setOpenSubmenu(null);
      } else if (openMenu && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const currentIdx = menuKeys.indexOf(openMenu);
        if (currentIdx !== -1) {
          e.preventDefault();
          const nextIdx =
            e.key === "ArrowRight"
              ? (currentIdx + 1) % menuKeys.length
              : (currentIdx - 1 + menuKeys.length) % menuKeys.length;
          setOpenMenu(menuKeys[nextIdx]);
          setOpenSubmenu(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMenu]);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (e) {}
  };

  const handleToggleMaximize = async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch (e) {}
  };

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (e) {}
  };

  const handleHeaderMouseEnter = (menuKey: string) => {
    if (openMenu !== null && openMenu !== menuKey) {
      setOpenMenu(menuKey);
      setOpenSubmenu(null);
    }
  };

  const handleHeaderClick = (menuKey: string) => {
    if (openMenu === menuKey) {
      setOpenMenu(null);
      setOpenSubmenu(null);
    } else {
      setOpenMenu(menuKey);
      setOpenSubmenu(null);
    }
  };

  const closeMenus = () => {
    setOpenMenu(null);
    setOpenSubmenu(null);
  };

  return (
    <div
      data-tauri-drag-region
      className="bg-rilo-surface border-b border-rilo-border px-2 h-9 flex items-center justify-between select-none flex-shrink-0 font-sans text-xs"
    >
      {/* Left: App Logo + Desktop Menu Bar */}
      <div data-tauri-drag-region className="flex items-center space-x-2 flex-1 min-w-0 h-full">
        {/* App Logo */}
        <div data-tauri-drag-region className="flex items-center space-x-1.5 pr-2 font-semibold text-rilo-primary text-xs">
          <div className="w-5 h-5 rounded bg-rilo-accent text-rilo-bg font-bold flex items-center justify-center text-[11px] shadow-xs">
            R
          </div>
          <span data-tauri-drag-region className="tracking-tight font-bold text-rilo-primary">
            Rilo
          </span>
        </div>

        {/* Desktop Application Menu Bar */}
        <div ref={menuRef} className="flex items-center space-x-0.5 relative font-medium text-[11px] text-rilo-muted">
          {/* File Menu */}
          <div className="relative" onMouseEnter={() => handleHeaderMouseEnter("file")}>
            <button
              type="button"
              onClick={() => handleHeaderClick("file")}
              className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                openMenu === "file" ? "bg-rilo-elevated text-rilo-primary font-semibold" : "hover:text-rilo-primary hover:bg-rilo-elevated/60"
              }`}
            >
              File
            </button>
            {openMenu === "file" && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onNewTask();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>New Download...</span>
                  <span className="text-[10px] text-rilo-muted font-mono">Ctrl+N</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenFolderSelected();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Open Download Folder</span>
                  <span className="text-[10px] text-rilo-muted font-mono">Ctrl+F</span>
                </button>
                <div className="my-1 border-t border-rilo-border/60" />
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Exit</span>
                  <span className="text-[10px] text-rilo-muted font-mono">Alt+F4</span>
                </button>
              </div>
            )}
          </div>

          {/* Tasks Menu */}
          <div className="relative" onMouseEnter={() => handleHeaderMouseEnter("tasks")}>
            <button
              type="button"
              onClick={() => handleHeaderClick("tasks")}
              className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                openMenu === "tasks" ? "bg-rilo-elevated text-rilo-primary font-semibold" : "hover:text-rilo-primary hover:bg-rilo-elevated/60"
              }`}
            >
              Tasks
            </button>
            {openMenu === "tasks" && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onResumeSelected();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Start / Resume</span>
                  <span className="text-[10px] text-rilo-muted font-mono">Ctrl+R</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPauseSelected();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Pause</span>
                  <span className="text-[10px] text-rilo-muted font-mono">Ctrl+P</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCancelSelected();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Stop / Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResumeSelected();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Restart Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteSelected();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                >
                  <span>Delete</span>
                  <span className="text-[10px] text-rilo-muted font-mono">Delete</span>
                </button>
                <div className="my-1 border-t border-rilo-border/60" />
                {/* Submenu Trigger: Move to Queue */}
                <div
                  className="relative"
                  onMouseEnter={() => setOpenSubmenu("queue")}
                  onMouseLeave={() => setOpenSubmenu(null)}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                  >
                    <span>Move to Queue</span>
                    <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />
                  </button>
                  {openSubmenu === "queue" && (
                    <div className="absolute left-full top-0 ml-1 w-40 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 text-xs z-50">
                      <button
                        type="button"
                        onClick={closeMenus}
                        className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                      >
                        Main Queue
                      </button>
                    </div>
                  )}
                </div>
                {/* Submenu Trigger: Move to Category */}
                <div
                  className="relative"
                  onMouseEnter={() => setOpenSubmenu("category")}
                  onMouseLeave={() => setOpenSubmenu(null)}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface flex items-center justify-between cursor-pointer"
                  >
                    <span>Move to Category</span>
                    <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />
                  </button>
                  {openSubmenu === "category" && (
                    <div className="absolute left-full top-0 ml-1 w-40 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 text-xs z-50">
                      {["Compressed", "Programs", "Videos", "Music", "Pictures", "Documents"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={closeMenus}
                          className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="my-1 border-t border-rilo-border/60" />
                <button
                  type="button"
                  onClick={() => {
                    onClearCompleted();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                >
                  Clean Finished
                </button>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative" onMouseEnter={() => handleHeaderMouseEnter("tools")}>
            <button
              type="button"
              onClick={() => handleHeaderClick("tools")}
              className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                openMenu === "tools" ? "bg-rilo-elevated text-rilo-primary font-semibold" : "hover:text-rilo-primary hover:bg-rilo-elevated/60"
              }`}
            >
              Tools
            </button>
            {openMenu === "tools" && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onOpenScheduler();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                >
                  Scheduler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                >
                  Settings
                </button>
              </div>
            )}
          </div>

          {/* Theme Menu */}
          <div className="relative" onMouseEnter={() => handleHeaderMouseEnter("theme")}>
            <button
              type="button"
              onClick={() => handleHeaderClick("theme")}
              className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                openMenu === "theme" ? "bg-rilo-elevated text-rilo-primary font-semibold" : "hover:text-rilo-primary hover:bg-rilo-elevated/60"
              }`}
            >
              Theme
            </button>
            {openMenu === "theme" && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 z-50 text-xs max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                {riloThemes.map((t) => {
                  const isSelected = currentThemeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (onSelectTheme) onSelectTheme(t.id);
                        closeMenus();
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-rilo-surface text-rilo-accent font-bold"
                          : "text-rilo-primary hover:bg-rilo-surface"
                      }`}
                    >
                      <span>{t.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-rilo-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="relative" onMouseEnter={() => handleHeaderMouseEnter("help")}>
            <button
              type="button"
              onClick={() => handleHeaderClick("help")}
              className={`px-2 py-1 rounded-xs transition-colors cursor-pointer ${
                openMenu === "help" ? "bg-rilo-elevated text-rilo-primary font-semibold" : "hover:text-rilo-primary hover:bg-rilo-elevated/60"
              }`}
            >
              Help
            </button>
            {openMenu === "help" && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 z-50 text-xs animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAbout();
                    closeMenus();
                  }}
                  className="w-full px-3 py-1.5 text-left text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                >
                  About Rilo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Search Input & Window Controls */}
      <div className="flex items-center space-x-3 flex-shrink-0 h-full">
        {/* Compact Search Input in Header */}
        <div className="relative w-52">
          <Search className="w-3.5 h-3.5 text-rilo-muted absolute left-2 top-1.5 pointer-events-none" />
          <input
            ref={searchInputRef as any}
            type="text"
            placeholder="Search in the List..."
            value={searchQuery}
            onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
            className="w-full pl-7 pr-2 py-0.5 text-[11px] bg-rilo-elevated border border-rilo-border rounded text-rilo-primary placeholder-rilo-muted focus:outline-none focus:border-rilo-accent"
          />
        </div>

        {/* Window Controls */}
        <div className="flex items-center space-x-0.5 h-full -mr-1">
          <button
            type="button"
            onClick={handleMinimize}
            className="w-7 h-6 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors rounded-xs cursor-pointer"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="w-7 h-6 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors rounded-xs cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-2.5 h-2.5" />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-6 flex items-center justify-center text-rilo-muted hover:text-white hover:bg-rose-600 transition-colors rounded-xs cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
