import { useState, useRef, useEffect } from "preact/hooks";

export type AppTheme = "dark" | "light" | "default" | "xbox";

interface TopMenuBarProps {
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  onNewTask: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onClearFinished: () => void;
  onOpenAbout: () => void;
}

export default function TopMenuBar({
  currentTheme,
  onSelectTheme,
  onNewTask,
  onPauseAll,
  onResumeAll,
  onClearFinished,
  onOpenAbout,
}: TopMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (name: string) => {
    setOpenMenu(openMenu === name ? null : name);
  };

  return (
    <div
      ref={menuRef}
      className="bg-rilo-surface border-b border-rilo-border px-2 py-0.5 flex items-center space-x-1 text-xs select-none relative z-40 text-rilo-secondary font-sans"
    >
      {/* File Dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleMenu("file")}
          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
            openMenu === "file" ? "bg-rilo-elevated text-rilo-primary" : "hover:bg-rilo-elevated hover:text-rilo-primary"
          }`}
        >
          File
        </button>
        {openMenu === "file" && (
          <div className="absolute left-0 mt-1 w-48 bg-rilo-surface border border-rilo-border rounded-md shadow-2xl py-1 z-50">
            <button
              onClick={() => {
                setOpenMenu(null);
                onNewTask();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rilo-elevated text-xs text-rilo-primary flex items-center justify-between cursor-pointer"
            >
              <span>+ Add New Download</span>
              <span className="text-[10px] text-rilo-muted font-mono">Ctrl+N</span>
            </button>
            <button
              onClick={() => {
                setOpenMenu(null);
                onClearFinished();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rilo-elevated text-xs text-rilo-primary cursor-pointer"
            >
              Clear Finished
            </button>
          </div>
        )}
      </div>

      {/* Tasks Dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleMenu("tasks")}
          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
            openMenu === "tasks" ? "bg-rilo-elevated text-rilo-primary" : "hover:bg-rilo-elevated hover:text-rilo-primary"
          }`}
        >
          Tasks
        </button>
        {openMenu === "tasks" && (
          <div className="absolute left-0 mt-1 w-48 bg-rilo-surface border border-rilo-border rounded-md shadow-2xl py-1 z-50">
            <button
              onClick={() => {
                setOpenMenu(null);
                onResumeAll();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rilo-elevated text-xs text-emerald-400 font-medium cursor-pointer"
            >
              Resume All Tasks
            </button>
            <button
              onClick={() => {
                setOpenMenu(null);
                onPauseAll();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rilo-elevated text-xs text-amber-400 font-medium cursor-pointer"
            >
              Pause All Tasks
            </button>
          </div>
        )}
      </div>

      {/* Themes Dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleMenu("themes")}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1 ${
            openMenu === "themes"
              ? "bg-rilo-elevated text-rilo-primary"
              : "hover:bg-rilo-elevated text-rilo-accent"
          }`}
        >
          <span>Themes</span>
          <svg className="w-3 h-3 text-rilo-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {openMenu === "themes" && (
          <div className="absolute left-0 mt-1 w-52 bg-rilo-surface border border-rilo-border rounded-md shadow-2xl py-1 z-50">
            <button
              onClick={() => {
                setOpenMenu(null);
                onSelectTheme("dark");
              }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between cursor-pointer ${
                currentTheme === "dark" || currentTheme === "default"
                  ? "bg-rilo-accent-muted text-rilo-accent font-bold"
                  : "hover:bg-rilo-elevated text-rilo-primary"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rilo-accent" />
                <span>Dark Mode</span>
              </div>
              {(currentTheme === "dark" || currentTheme === "default") && <span>✓</span>}
            </button>
            <button
              onClick={() => {
                setOpenMenu(null);
                onSelectTheme("light");
              }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between cursor-pointer ${
                currentTheme === "light"
                  ? "bg-rilo-accent-muted text-rilo-accent font-bold"
                  : "hover:bg-rilo-elevated text-rilo-primary"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Light Mode</span>
              </div>
              {currentTheme === "light" && <span>✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* Help Dropdown */}
      <div className="relative">
        <button
          onClick={() => toggleMenu("help")}
          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
            openMenu === "help" ? "bg-rilo-elevated text-rilo-primary" : "hover:bg-rilo-elevated hover:text-rilo-primary"
          }`}
        >
          Help
        </button>
        {openMenu === "help" && (
          <div className="absolute left-0 mt-1 w-40 bg-rilo-surface border border-rilo-border rounded-md shadow-2xl py-1 z-50">
            <button
              onClick={() => {
                setOpenMenu(null);
                onOpenAbout();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rilo-elevated text-xs text-rilo-primary cursor-pointer"
            >
              About Downloader
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
