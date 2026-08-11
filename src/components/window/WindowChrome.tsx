import { useState, useEffect } from "preact/hooks";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-preact";

interface WindowChromeProps {
  title: string;
  subtitle?: string;
  icon?: any;
  showMaximize?: boolean;
  onClose?: () => void;
}

export default function WindowChrome({
  title,
  subtitle,
  icon: Icon,
  showMaximize = true,
  onClose,
}: WindowChromeProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized).catch(() => {});

    let unlisten: (() => void) | undefined;
    win.onResized(() => {
      win.isMaximized().then(setIsMaximized).catch(() => {});
    }).then((cb) => {
      unlisten = cb;
    }).catch(() => {});

    return () => unlisten?.();
  }, []);

  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (err) {
      console.error("Failed to minimize window:", err);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch (err) {
      console.error("Failed to toggle maximize:", err);
    }
  };

  const handleClose = async () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (err) {
      window.close();
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="bg-rilo-surface border-b border-rilo-border px-3 h-8 flex items-center justify-between select-none flex-shrink-0 font-sans text-xs"
    >
      {/* Title & Icon Area (Draggable) */}
      <div data-tauri-drag-region className="flex items-center space-x-2 min-w-0 flex-1 h-full pr-2">
        {Icon ? (
          <Icon className="w-3.5 h-3.5 text-rilo-accent flex-shrink-0" data-tauri-drag-region />
        ) : (
          <div
            className="w-3.5 h-3.5 rounded bg-rilo-accent text-rilo-bg font-bold flex items-center justify-center text-[9px] flex-shrink-0"
            data-tauri-drag-region
          >
            R
          </div>
        )}
        <div data-tauri-drag-region className="flex items-center space-x-1.5 min-w-0 font-medium truncate">
          <span data-tauri-drag-region className="text-rilo-primary font-semibold truncate text-[11px]">
            {title}
          </span>
          {subtitle && (
            <>
              <span data-tauri-drag-region className="text-rilo-muted text-[10px]">
                •
              </span>
              <span data-tauri-drag-region className="text-rilo-muted text-[10px] truncate">
                {subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Window Controls (Non-draggable buttons) */}
      <div className="flex items-center space-x-0.5 -mr-1 h-full flex-shrink-0">
        <button
          type="button"
          onClick={handleMinimize}
          className="w-7 h-6 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors rounded-xs cursor-pointer"
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus className="w-3 h-3" />
        </button>

        {showMaximize && (
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="w-7 h-6 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors rounded-xs cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-2.5 h-2.5" />}
          </button>
        )}

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
  );
}
