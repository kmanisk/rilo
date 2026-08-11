import { useState } from "preact/hooks";
import {
  Download,
  Play,
  Clock,
  Pause,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Video,
  Music,
  FileText,
  Binary,
  Archive,
  Image as ImageIcon,
  Layers,
  ChevronDown,
  ChevronRight,
  Folder,
} from "lucide-preact";

export type CategoryTab =
  | "all"
  | "downloading"
  | "queued"
  | "paused"
  | "completed"
  | "failed"
  | "cat_Videos"
  | "cat_Music"
  | "cat_Documents"
  | "cat_Programs"
  | "cat_Archives"
  | "cat_Images"
  | "cat_Other";

interface SidebarProps {
  activeTab: CategoryTab;
  onSelectTab: (tab: CategoryTab) => void;
  statusCounts: {
    all: number;
    downloading: number;
    queued: number;
    paused: number;
    completed: number;
    failed: number;
  };
  categoryCounts: {
    Videos: number;
    Music: number;
    Documents: number;
    Programs: number;
    Archives: number;
    Images: number;
    Other: number;
  };
  onOpenScheduler: () => void;
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  statusCounts,
  categoryCounts,
  onOpenScheduler,
}: SidebarProps) {
  const [isAllExpanded, setIsAllExpanded] = useState(true);
  const [isFinishedExpanded, setIsFinishedExpanded] = useState(false);
  const [isUnfinishedExpanded, setIsUnfinishedExpanded] = useState(false);
  const [isQueuesExpanded, setIsQueuesExpanded] = useState(false);

  const categoryItems: { id: CategoryTab; label: string; countKey: keyof typeof categoryCounts; icon: any }[] = [
    { id: "cat_Archives", label: "Compressed", countKey: "Archives", icon: Archive },
    { id: "cat_Programs", label: "Programs", countKey: "Programs", icon: Binary },
    { id: "cat_Videos", label: "Videos", countKey: "Videos", icon: Video },
    { id: "cat_Music", label: "Music", countKey: "Music", icon: Music },
    { id: "cat_Images", label: "Pictures", countKey: "Images", icon: ImageIcon },
    { id: "cat_Documents", label: "Documents", countKey: "Documents", icon: FileText },
  ];

  return (
    <aside className="w-52 bg-rilo-surface border-r border-rilo-border flex flex-col justify-between select-none h-full font-sans flex-shrink-0">
      <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar text-xs">
        {/* Accordion 1: All (Expanded by default) */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsAllExpanded(!isAllExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              {isAllExpanded ? <ChevronDown className="w-3.5 h-3.5 text-rilo-accent" /> : <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />}
              <Folder className="w-4 h-4 text-rilo-accent flex-shrink-0" />
              <span className="truncate">All</span>
            </div>
            <span className="text-[10px] font-mono text-rilo-muted font-semibold">{statusCounts.all}</span>
          </button>

          {isAllExpanded && (
            <div className="space-y-0.5 pl-5 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => onSelectTab("all")}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  activeTab === "all"
                    ? "bg-rilo-elevated text-rilo-accent font-bold border-l-2 border-rilo-accent"
                    : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                }`}
              >
                <span>All Downloads</span>
                <span className="text-[10px] font-mono">{statusCounts.all}</span>
              </button>

              {categoryItems.map((cat) => {
                const isActive = activeTab === cat.id;
                const count = categoryCounts[cat.countKey] || 0;
                const Icon = cat.icon;

                return (
                  <button
                    key={cat.id}
                    onClick={() => onSelectTab(cat.id)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                      isActive
                        ? "bg-rilo-elevated text-rilo-accent font-bold border-l-2 border-rilo-accent"
                        : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-rilo-accent" : "text-rilo-muted"}`} />
                      <span className="truncate">{cat.label}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-[10px] font-mono text-rilo-muted">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Accordion 2: Finished (Collapsed by default) */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsFinishedExpanded(!isFinishedExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              {isFinishedExpanded ? <ChevronDown className="w-3.5 h-3.5 text-rilo-accent" /> : <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />}
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate">Finished</span>
            </div>
            <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.completed}</span>
          </button>

          {isFinishedExpanded && (
            <div className="space-y-0.5 pl-5 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => onSelectTab("completed")}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  activeTab === "completed"
                    ? "bg-rilo-elevated text-emerald-400 font-bold border-l-2 border-emerald-400"
                    : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                }`}
              >
                <span>Completed Tasks</span>
                <span className="text-[10px] font-mono">{statusCounts.completed}</span>
              </button>
            </div>
          )}
        </div>

        {/* Accordion 3: Unfinished (Collapsed by default) */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsUnfinishedExpanded(!isUnfinishedExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              {isUnfinishedExpanded ? <ChevronDown className="w-3.5 h-3.5 text-rilo-accent" /> : <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />}
              <Download className="w-4 h-4 text-rilo-accent flex-shrink-0" />
              <span className="truncate">Unfinished</span>
            </div>
            <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.downloading + statusCounts.paused + statusCounts.queued}</span>
          </button>

          {isUnfinishedExpanded && (
            <div className="space-y-0.5 pl-5 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => onSelectTab("downloading")}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  activeTab === "downloading"
                    ? "bg-rilo-elevated text-rilo-accent font-bold border-l-2 border-rilo-accent"
                    : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Play className="w-3.5 h-3.5 text-rilo-accent" />
                  <span>Downloading</span>
                </div>
                <span className="text-[10px] font-mono">{statusCounts.downloading}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("paused")}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  activeTab === "paused"
                    ? "bg-rilo-elevated text-amber-400 font-bold border-l-2 border-amber-400"
                    : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Paused</span>
                </div>
                <span className="text-[10px] font-mono">{statusCounts.paused}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("queued")}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                  activeTab === "queued"
                    ? "bg-rilo-elevated text-rilo-muted font-bold border-l-2 border-rilo-muted"
                    : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-rilo-muted" />
                  <span>Queued</span>
                </div>
                <span className="text-[10px] font-mono">{statusCounts.queued}</span>
              </button>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-rilo-border/60" />

        {/* Accordion 4: Queues (Collapsed by default) */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setIsQueuesExpanded(!isQueuesExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              {isQueuesExpanded ? <ChevronDown className="w-3.5 h-3.5 text-rilo-accent" /> : <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />}
              <Layers className="w-4 h-4 text-rilo-accent flex-shrink-0" />
              <span className="truncate">Queues</span>
            </div>
          </button>

          {isQueuesExpanded && (
            <div className="space-y-0.5 pl-5 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={onOpenScheduler}
                className="w-full flex items-center space-x-1.5 px-2 py-1 rounded text-xs font-medium text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary transition-colors cursor-pointer"
              >
                <CalendarClock className="w-3.5 h-3.5 text-rilo-accent" />
                <span>Main Queue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
