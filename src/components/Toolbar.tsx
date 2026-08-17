import { DownloadItem } from "../types";
import {
  Link as LinkIcon,
  Play,
  Pause,
  Square,
  Trash2,
  CalendarClock,
  Settings,
  Info,
  ExternalLink,
  Download,
} from "lucide-preact";
import { isActiveDownload, isResumableStatus, normalizeDownloadStatus } from "../lib/downloads/status";

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
  onOpenTestWindow?: () => void;
  showIconLabels?: boolean;
}

export default function Toolbar({
  selectedItem,
  onNewTask,
  onPauseSelected,
  onResumeSelected,
  onCancelSelected,
  onDeleteSelected,
  onOpenDetailsSelected,
  onOpenScheduler,
  onOpenSettings,
  onOpenTestWindow,
  showIconLabels = true,
}: ToolbarProps) {
  const statusLower = normalizeDownloadStatus(selectedItem?.status);
  const isDownloading = isActiveDownload(statusLower);
  const isPaused = isResumableStatus(statusLower);
  const canPause = isDownloading;
  const canResume = isPaused;
  const canStop = isDownloading || isPaused;
  const canDelete = selectedItem !== null;

  return (
    <div className="bg-rilo-surface border-b border-rilo-border px-3 py-1.5 flex items-center justify-between select-none flex-shrink-0 font-sans text-xs h-12">
      {/* Grouped Command Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto custom-scrollbar py-0.5">
        {/* Primary Action: New Download */}
        <button
          type="button"
          onClick={onNewTask}
          className="bg-rilo-elevated border border-rilo-border hover:border-rilo-accent text-rilo-primary font-medium px-3 py-1 rounded-md text-xs flex items-center space-x-2 shadow-xs transition-all cursor-pointer group h-8"
          title="Add New Download (Ctrl+N)"
          aria-label="New Download"
        >
          <LinkIcon className="w-3.5 h-3.5 text-rilo-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-rilo-primary">New Download</span>
          <div className="w-4 h-4 rounded-full bg-rilo-accent text-rilo-bg flex items-center justify-center text-[10px] font-bold ml-1">
            <Download className="w-2.5 h-2.5" />
          </div>
        </button>

        <div className="h-5 w-px bg-rilo-border/80 mx-1" />

        {/* Transfer Control Group: Resume, Pause */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={onResumeSelected}
            disabled={!canResume}
            className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 transition-colors ${
              canResume
                ? "text-rilo-primary hover:bg-rilo-elevated cursor-pointer"
                : "text-rilo-muted opacity-45 cursor-not-allowed"
            }`}
            title="Resume selected download"
          >
            <Play className={`w-4 h-4 ${canResume ? "text-emerald-400" : "text-rilo-muted"}`} />
            {showIconLabels && <span className="text-[11px] font-medium">Resume</span>}
          </button>

          <button
            type="button"
            onClick={onPauseSelected}
            disabled={!canPause}
            className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 transition-colors ${
              canPause
                ? "text-rilo-primary hover:bg-rilo-elevated cursor-pointer"
                : "text-rilo-muted opacity-45 cursor-not-allowed"
            }`}
            title="Pause selected download"
          >
            <Pause className={`w-4 h-4 ${canPause ? "text-amber-400" : "text-rilo-muted"}`} />
            {showIconLabels && <span className="text-[11px] font-medium">Pause</span>}
          </button>
        </div>

        <div className="h-5 w-px bg-rilo-border/80 mx-1" />

        {/* Queue Management Group */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            disabled={true}
            className="px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 text-rilo-muted opacity-45 cursor-not-allowed"
            title="Start Queue (Feature coming soon)"
          >
            <Play className="w-4 h-4 text-rilo-muted" />
            {showIconLabels && <span className="text-[11px] font-medium">Start Queue</span>}
          </button>

          <button
            type="button"
            disabled={true}
            className="px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 text-rilo-muted opacity-45 cursor-not-allowed"
            title="Stop Queue (Feature coming soon)"
          >
            <Square className="w-4 h-4 text-rilo-muted" />
            {showIconLabels && <span className="text-[11px] font-medium">Stop Queue</span>}
          </button>

          <button
            type="button"
            onClick={onOpenScheduler}
            className="px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 text-rilo-primary hover:bg-rilo-elevated transition-colors cursor-pointer"
            title="Open Queue Scheduler"
          >
            <CalendarClock className="w-4 h-4 text-rilo-accent" />
            {showIconLabels && <span className="text-[11px] font-medium">Queues</span>}
          </button>
        </div>

        <div className="h-5 w-px bg-rilo-border/80 mx-1" />

        {/* Management Group: Stop All, Delete */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={onCancelSelected}
            disabled={!canStop}
            className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 transition-colors ${
              canStop
                ? "text-rilo-primary hover:bg-rilo-elevated cursor-pointer"
                : "text-rilo-muted opacity-45 cursor-not-allowed"
            }`}
            title="Stop selected task"
          >
            <Square className={`w-4 h-4 ${canStop ? "text-rose-400" : "text-rilo-muted"}`} />
            {showIconLabels && <span className="text-[11px] font-medium">Stop All</span>}
          </button>

          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!canDelete}
            className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 transition-colors ${
              canDelete
                ? "text-rilo-primary hover:bg-rilo-elevated hover:text-rose-400 cursor-pointer"
                : "text-rilo-muted opacity-45 cursor-not-allowed"
            }`}
            title="Delete selected download"
          >
            <Trash2 className={`w-4 h-4 ${canDelete ? "text-rilo-primary" : "text-rilo-muted"}`} />
            {showIconLabels && <span className="text-[11px] font-medium">Delete</span>}
          </button>
        </div>

        <div className="h-5 w-px bg-rilo-border/80 mx-1" />

        {/* Preferences & Windows Group: Settings, Details, Test Window */}
        <div className="flex items-center space-x-1">
          {onOpenDetailsSelected && (
            <button
              type="button"
              onClick={onOpenDetailsSelected}
              disabled={!selectedItem}
              className={`px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 transition-colors ${
                selectedItem
                  ? "text-rilo-accent hover:bg-rilo-elevated cursor-pointer"
                  : "text-rilo-muted opacity-45 cursor-not-allowed"
              }`}
              title="Open task details inspector window"
            >
              <Info className="w-4 h-4" />
              {showIconLabels && <span className="text-[11px] font-medium">Details</span>}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="px-2.5 py-1 rounded text-xs flex items-center space-x-1.5 h-8 text-rilo-primary hover:bg-rilo-elevated transition-colors cursor-pointer"
            title="Settings Preferences"
          >
            <Settings className="w-4 h-4 text-rilo-muted" />
            {showIconLabels && <span className="text-[11px] font-medium">Settings</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
