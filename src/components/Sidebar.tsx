import { useState } from "preact/hooks";
import {
  Download,
  Play,
  Clock,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Folder,
  CalendarClock,
  Video,
  Music,
  FileText,
  Binary,
  Archive,
  Image,
  Layers,
  ChevronDown,
  ChevronRight,
  ListFilter,
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
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(true);
  const [isQueuesExpanded, setIsQueuesExpanded] = useState(true);

  const downloadStatusItems: { id: CategoryTab; label: string; countKey: keyof typeof statusCounts; icon: any }[] = [
    { id: "all", label: "All Downloads", countKey: "all", icon: Download },
    { id: "downloading", label: "Downloading", countKey: "downloading", icon: Play },
    { id: "queued", label: "Queued", countKey: "queued", icon: Clock },
    { id: "paused", label: "Paused", countKey: "paused", icon: Pause },
    { id: "completed", label: "Completed", countKey: "completed", icon: CheckCircle2 },
    { id: "failed", label: "Failed", countKey: "failed", icon: AlertTriangle },
  ];

  const categoryItems: { id: CategoryTab; label: string; countKey: keyof typeof categoryCounts; icon: any }[] = [
    { id: "cat_Videos", label: "Videos", countKey: "Videos", icon: Video },
    { id: "cat_Music", label: "Music", countKey: "Music", icon: Music },
    { id: "cat_Documents", label: "Documents", countKey: "Documents", icon: FileText },
    { id: "cat_Programs", label: "Programs", countKey: "Programs", icon: Binary },
    { id: "cat_Archives", label: "Archives", countKey: "Archives", icon: Archive },
    { id: "cat_Images", label: "Images", countKey: "Images", icon: Image },
    { id: "cat_Other", label: "Other", countKey: "Other", icon: Layers },
  ];

  return (
    <aside className="w-52 bg-rilo-surface border-r border-rilo-border flex flex-col justify-between select-none h-full font-sans flex-shrink-0">
      <div className="overflow-y-auto p-2 space-y-3 custom-scrollbar">
        {/* Navigation Group 1: ALL DOWNLOADS (PERMANENTLY EXPANDED) */}
        <div className="space-y-0.5">
          <div className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rilo-muted">
            <span>Downloads</span>
            <span className="text-[9px] font-mono text-rilo-muted font-normal">({statusCounts.all})</span>
          </div>

          <div className="space-y-0.5 pl-1">
            {downloadStatusItems.map((item) => {
                const isActive = activeTab === item.id;
                const count = statusCounts[item.countKey] || 0;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-rilo-elevated text-rilo-accent font-bold border-l-2 border-rilo-accent"
                        : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-rilo-accent" : "text-rilo-muted"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {count > 0 && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                          isActive ? "bg-rilo-accent-muted text-rilo-accent" : "bg-rilo-elevated text-rilo-muted"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        {/* Navigation Group 2: CATEGORIES */}
        <div className="space-y-0.5 pt-2 border-t border-rilo-border/60">
          <button
            type="button"
            onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rilo-muted hover:text-rilo-primary transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5">
              {isCategoriesExpanded ? <ChevronDown className="w-3 h-3 text-rilo-accent" /> : <ChevronRight className="w-3 h-3 text-rilo-muted" />}
              <span>Categories</span>
            </div>
          </button>

          {isCategoriesExpanded && (
            <div className="space-y-0.5 pl-1.5 animate-in fade-in duration-100">
              {categoryItems.map((cat) => {
                const isActive = activeTab === cat.id;
                const count = categoryCounts[cat.countKey] || 0;
                const Icon = cat.icon;

                return (
                  <button
                    key={cat.id}
                    onClick={() => onSelectTab(cat.id)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-rilo-elevated text-rilo-accent font-bold border-l-2 border-rilo-accent"
                        : "text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-rilo-accent" : "text-rilo-muted"}`} />
                      <span className="truncate">{cat.label}</span>
                    </div>
                    {count > 0 && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full tabular-nums ${
                          isActive ? "bg-rilo-accent-muted text-rilo-accent" : "bg-rilo-elevated text-rilo-muted"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation Group 3: QUEUES & SCHEDULER */}
        <div className="space-y-0.5 pt-2 border-t border-rilo-border/60">
          <button
            type="button"
            onClick={() => setIsQueuesExpanded(!isQueuesExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-rilo-muted hover:text-rilo-primary transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5">
              {isQueuesExpanded ? <ChevronDown className="w-3 h-3 text-rilo-accent" /> : <ChevronRight className="w-3 h-3 text-rilo-muted" />}
              <span>Queues</span>
            </div>
          </button>

          {isQueuesExpanded && (
            <div className="space-y-0.5 pl-1.5 animate-in fade-in duration-100">
              <button
                onClick={onOpenScheduler}
                className="w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium text-rilo-secondary hover:bg-rilo-elevated/70 hover:text-rilo-primary transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <CalendarClock className="w-3.5 h-3.5 text-rilo-accent" />
                  <span>Main Queue Scheduler</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
