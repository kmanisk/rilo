import { DownloadItem } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import {
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  FolderOpen,
  CheckCheck,
  CalendarClock,
  Settings,
  Search,
  Info,
} from "lucide-preact";

interface ToolbarProps {
  selectedItem: DownloadItem | null;
  hasCompleted: boolean;
  onNewTask: () => void;
  onPauseSelected: () => void;
  onResumeSelected: () => void;
  onCancelSelected: () => void;
  onDeleteSelected: () => void;
  onClearCompleted: () => void;
  onOpenFolderSelected: () => void;
  onOpenDetailsSelected?: () => void;
  onOpenScheduler: () => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: { current: HTMLInputElement | null };
}

export default function Toolbar({
  selectedItem,
  hasCompleted,
  onNewTask,
  onPauseSelected,
  onResumeSelected,
  onCancelSelected,
  onDeleteSelected,
  onClearCompleted,
  onOpenFolderSelected,
  onOpenDetailsSelected,
  onOpenScheduler,
  onOpenSettings,
  searchQuery,
  onSearchChange,
  searchInputRef,
}: ToolbarProps) {
  const statusLower = (selectedItem?.status || "").toLowerCase();
  const isDownloading = statusLower === "downloading" || statusLower === "reconnecting" || statusLower === "restarting";
  const isPaused = statusLower === "paused" || statusLower === "queued" || statusLower === "error" || statusLower === "failed" || statusLower === "cancelled";
  const canPause = isDownloading;
  const canResume = isPaused;
  const canStop = isDownloading || isPaused;
  const canDelete = selectedItem !== null;
  const canOpenFolder = selectedItem !== null && selectedItem.savePath.length > 0;

  return (
    <div className="bg-rilo-surface border-b border-rilo-border px-3 py-1.5 flex items-center justify-between gap-3 select-none flex-shrink-0 font-sans">
      {/* Primary Action Buttons Bar */}
      <div className="flex items-center space-x-1.5">
        {/* + Add URL */}
        <Button
          onClick={onNewTask}
          size="sm"
          className="font-semibold shadow-sm space-x-1 px-2.5 py-1 text-xs"
          title="Add new download URL (Ctrl+N)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task</span>
        </Button>

        <div className="h-4 w-px bg-rilo-border mx-0.5" />

        {/* Start / Resume */}
        <Button
          onClick={onResumeSelected}
          disabled={!canResume}
          variant="emerald"
          size="sm"
          className="space-x-1 px-2 py-1 text-[11px]"
          title="Resume selected download"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Resume</span>
        </Button>

        {/* Pause */}
        <Button
          onClick={onPauseSelected}
          disabled={!canPause}
          variant="amber"
          size="sm"
          className="space-x-1 px-2 py-1 text-[11px]"
          title="Pause selected download"
        >
          <Pause className="w-3.5 h-3.5" />
          <span>Pause</span>
        </Button>

        {/* Stop / Cancel */}
        <Button
          onClick={onCancelSelected}
          disabled={!canStop}
          variant="danger"
          size="sm"
          className="space-x-1 px-2 py-1 text-[11px]"
          title="Stop selected task"
        >
          <Square className="w-3.5 h-3.5" />
          <span>Stop</span>
        </Button>

        {/* Delete */}
        <Button
          onClick={onDeleteSelected}
          disabled={!canDelete}
          variant="outline"
          size="sm"
          className="space-x-1 px-2 py-1 text-[11px] hover:text-rose-400"
          title="Delete selected download"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </Button>

        <div className="h-4 w-px bg-rilo-border mx-0.5" />

        {/* Open Folder */}
        <Button
          onClick={onOpenFolderSelected}
          disabled={!canOpenFolder}
          variant="outline"
          size="sm"
          className="space-x-1 px-2 py-1 text-[11px]"
          title="Open containing folder"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Folder</span>
        </Button>

        {/* View Details */}
        {onOpenDetailsSelected && (
          <Button
            onClick={onOpenDetailsSelected}
            disabled={!selectedItem}
            variant="outline"
            size="sm"
            className="space-x-1 px-2 py-1 text-[11px] text-rilo-accent"
            title="Open task details inspector"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Details</span>
          </Button>
        )}

        {/* Clear Completed */}
        <Button
          onClick={onClearCompleted}
          disabled={!hasCompleted}
          variant="outline"
          size="sm"
          className="space-x-1 px-2 py-1 text-[11px]"
          title="Clear completed downloads from list"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Clean Finished</span>
        </Button>
      </div>

      {/* Right Controls: Scheduler + Settings + Search */}
      <div className="flex items-center space-x-2">
        {/* Scheduler Link */}
        <Button
          onClick={onOpenScheduler}
          variant="outline"
          size="sm"
          className="text-rilo-accent space-x-1 px-2 py-1 text-[11px]"
          title="Queue / Scheduler Manager"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Scheduler</span>
        </Button>

        {/* Settings Button */}
        <Button
          onClick={onOpenSettings}
          variant="outline"
          size="icon"
          className="w-7 h-7"
          title="Settings Preferences"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>

        {/* Search Bar */}
        <div className="relative w-48">
          <Search className="w-3.5 h-3.5 text-rilo-muted absolute left-2 top-2 pointer-events-none" />
          <Input
            ref={searchInputRef as any}
            type="text"
            placeholder="Search (Ctrl+F)..."
            value={searchQuery}
            onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
            className="pl-7 py-1 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
