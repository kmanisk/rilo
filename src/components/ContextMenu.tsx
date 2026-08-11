import { useEffect, useRef, useState } from "preact/hooks";
import { DownloadItem } from "../types";
import {
  Play,
  Pause,
  FolderOpen,
  Copy,
  Trash2,
  FileMinus,
  FileText,
  Info,
  RotateCcw,
  Pencil,
  FileCheck,
  ChevronRight,
  Link,
  Layers,
  FolderTree,
} from "lucide-preact";
import { isActiveDownload, isResumableStatus, normalizeDownloadStatus } from "../lib/downloads/status";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  item: DownloadItem;
  position: ContextMenuPosition;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onCancel: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRemove: (id: string) => void;
  onDeleteFileDisk: (item: DownloadItem) => void;
  onRefreshLink: (item: DownloadItem) => void;
  onOpenDetails: (item: DownloadItem) => void;
  onExtractArchive?: (item: DownloadItem) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon?: any;
  shortcut?: string;
  disabled?: boolean;
  isDanger?: boolean;
  onClick?: () => void;
  submenu?: { id: string; label: string; icon?: any; onClick: () => void }[];
}

export default function ContextMenu({
  item,
  position,
  onClose,
  onPause,
  onResume,
  onOpenFile,
  onOpenFolder,
  onRemove,
  onDeleteFileDisk,
  onRefreshLink,
  onOpenDetails,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const statusLower = normalizeDownloadStatus(item.status);
  const isDownloading = isActiveDownload(statusLower);
  const isPaused = isResumableStatus(statusLower);
  const isCompleted = statusLower === "completed";
  const canResume = isPaused || statusLower === "error" || statusLower === "queued";
  const canPause = isDownloading;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onClose();
  };

  // Data-Driven Menu Structure with "Delete" and "Delete from List"
  const menuGroups: MenuItem[][] = [
    // Group 1: File & Transfer
    [
      {
        id: "open",
        label: "Open",
        icon: FileText,
        shortcut: "Ctrl+O",
        disabled: !isCompleted,
        onClick: () => onOpenFile(item.savePath),
      },
      {
        id: "open-folder",
        label: "Open Folder",
        icon: FolderOpen,
        shortcut: "Ctrl+F",
        disabled: false,
        onClick: () => onOpenFolder(item.savePath),
      },
      {
        id: "resume",
        label: "Resume",
        icon: Play,
        shortcut: "Ctrl+R",
        disabled: !canResume,
        onClick: () => onResume(item),
      },
      {
        id: "pause",
        label: "Pause",
        icon: Pause,
        shortcut: "Ctrl+P",
        disabled: !canPause,
        onClick: () => onPause(item.id),
      },
    ],
    // Group 2: Deletion Options
    [
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        shortcut: "Delete",
        disabled: false,
        isDanger: true,
        onClick: () => onDeleteFileDisk(item),
      },
      {
        id: "delete-list",
        label: "Delete from List",
        icon: FileMinus,
        disabled: false,
        onClick: () => onRemove(item.id),
      },
    ],
    // Group 3: Restart & Submenus
    [
      {
        id: "restart",
        label: "Restart Download",
        icon: RotateCcw,
        disabled: false,
        onClick: () => onResume(item),
      },
      {
        id: "move-queue",
        label: "Move To Queue",
        icon: Layers,
        disabled: false,
        submenu: [
          {
            id: "main-queue",
            label: "Main Queue",
            icon: Layers,
            onClick: () => onClose(),
          },
        ],
      },
      {
        id: "move-category",
        label: "Move To Category",
        icon: FolderTree,
        disabled: false,
        submenu: [
          "Compressed",
          "Programs",
          "Videos",
          "Music",
          "Pictures",
          "Documents",
        ].map((cat) => ({
          id: `cat-${cat}`,
          label: cat,
          onClick: () => onClose(),
        })),
      },
    ],
    // Group 4: Utilities & Properties
    [
      {
        id: "copy",
        label: "Copy",
        icon: Copy,
        disabled: false,
        submenu: [
          {
            id: "copy-url",
            label: "Copy Download URL",
            icon: Link,
            onClick: () => copyToClipboard(item.url),
          },
          {
            id: "copy-path",
            label: "Copy Local Path",
            icon: FolderOpen,
            onClick: () => copyToClipboard(item.savePath),
          },
        ],
      },
      {
        id: "edit",
        label: "Edit",
        icon: Pencil,
        shortcut: "Ctrl+E",
        disabled: false,
        onClick: () => onRefreshLink(item),
      },
      {
        id: "checksum",
        label: "File Checksum",
        icon: FileCheck,
        disabled: false,
        onClick: () => onOpenDetails(item),
      },
      {
        id: "properties",
        label: "Show Properties",
        icon: Info,
        shortcut: "Ctrl+I",
        disabled: false,
        onClick: () => onOpenDetails(item),
      },
    ],
  ];

  const flatItems = menuGroups.flat();

  // Keyboard navigation & accessibility handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = (prev + 1) % flatItems.length;
          while (flatItems[next].disabled && next !== prev) {
            next = (next + 1) % flatItems.length;
          }
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = (prev - 1 + flatItems.length) % flatItems.length;
          while (flatItems[next].disabled && next !== prev) {
            next = (next - 1 + flatItems.length) % flatItems.length;
          }
          return next;
        });
      } else if (e.key === "ArrowRight") {
        const currentItem = flatItems[focusedIndex];
        if (currentItem && currentItem.submenu && !currentItem.disabled) {
          e.preventDefault();
          setActiveSubmenu(currentItem.id);
        }
      } else if (e.key === "ArrowLeft") {
        if (activeSubmenu) {
          e.preventDefault();
          setActiveSubmenu(null);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const current = flatItems[focusedIndex];
        if (current && !current.disabled && current.onClick) {
          current.onClick();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, flatItems, activeSubmenu, onClose]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Viewport Boundary Collision Clamp
  const menuWidth = 230;
  const menuHeight = 390;
  const adjustedX = position.x + menuWidth > window.innerWidth ? Math.max(8, position.x - menuWidth) : position.x;
  const adjustedY = position.y + menuHeight > window.innerHeight ? Math.max(8, position.y - menuHeight) : position.y;

  let overallItemIndex = 0;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Download Item Context Menu"
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-56 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 text-[12px] font-sans select-none animate-in fade-in duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header: Truncated Filename */}
      <div className="px-2.5 py-1 border-b border-rilo-border/60">
        <span className="font-semibold text-rilo-primary truncate block text-[11px]" title={item.filename}>
          {item.filename}
        </span>
      </div>

      {/* Menu Groups */}
      {menuGroups.map((group, groupIdx) => (
        <div key={`group-${groupIdx}`}>
          {groupIdx > 0 && <div className="my-0.5 border-t border-rilo-border/60" />}
          <div className="py-0.5">
            {group.map((menuItem) => {
              const currentIdx = overallItemIndex++;
              const isFocused = focusedIndex === currentIdx;
              const Icon = menuItem.icon;
              const hasSubmenu = Boolean(menuItem.submenu && menuItem.submenu.length > 0);
              const isSubmenuActive = activeSubmenu === menuItem.id;

              return (
                <div
                  key={menuItem.id}
                  className="relative"
                  onMouseEnter={() => {
                    setFocusedIndex(currentIdx);
                    if (hasSubmenu && !menuItem.disabled) {
                      setActiveSubmenu(menuItem.id);
                    } else {
                      setActiveSubmenu(null);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasSubmenu) {
                      setActiveSubmenu(null);
                    }
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled={menuItem.disabled}
                    disabled={menuItem.disabled}
                    onClick={() => {
                      if (!menuItem.disabled && menuItem.onClick) {
                        menuItem.onClick();
                        onClose();
                      }
                    }}
                    className={`w-full px-2.5 py-1 flex items-center justify-between text-left transition-colors h-7.5 ${
                      menuItem.disabled
                        ? "text-rilo-muted opacity-40 cursor-not-allowed"
                        : menuItem.isDanger
                        ? "text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        : isFocused
                        ? "bg-rilo-surface text-rilo-primary cursor-pointer font-medium"
                        : "text-rilo-primary hover:bg-rilo-surface cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {Icon ? (
                        <Icon
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            menuItem.disabled
                              ? "text-rilo-muted"
                              : menuItem.isDanger
                              ? "text-rose-400"
                              : menuItem.id === "properties"
                              ? "text-rilo-accent"
                              : "text-rilo-primary"
                          }`}
                        />
                      ) : (
                        <div className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="truncate text-[11.5px]">{menuItem.label}</span>
                    </div>

                    {/* Right side: Shortcut or Submenu Chevron */}
                    {hasSubmenu ? (
                      <ChevronRight className="w-3 h-3 text-rilo-muted" />
                    ) : menuItem.shortcut ? (
                      <span className="text-[9.5px] font-mono text-rilo-muted bg-rilo-surface px-1 py-0.2 rounded">
                        {menuItem.shortcut}
                      </span>
                    ) : null}
                  </button>

                  {/* Submenu Floating Box */}
                  {hasSubmenu && isSubmenuActive && (
                    <div
                      role="menu"
                      aria-label={`${menuItem.label} Submenu`}
                      className="absolute left-full top-0 ml-1 w-44 bg-rilo-elevated border border-rilo-border rounded-md shadow-2xl py-1 text-[11.5px] z-50 animate-in fade-in duration-100"
                    >
                      {menuItem.submenu!.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              sub.onClick();
                              onClose();
                            }}
                            className="w-full px-2.5 py-1 text-left text-rilo-primary hover:bg-rilo-surface flex items-center space-x-2 cursor-pointer h-7.5"
                          >
                            {SubIcon && <SubIcon className="w-3.5 h-3.5 text-rilo-muted" />}
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
