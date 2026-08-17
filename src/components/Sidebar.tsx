import { useState } from "preact/hooks";
import {
  Download,
  Play,
  Clock,
  Pause,
  CheckCircle2,
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
  | "cat_Compressed"
  | "cat_Pictures"
  | "cat_Other"
  | "cat_Archives"
  | "cat_Images";

export interface CategoryCounts {
  Compressed: number;
  Programs: number;
  Videos: number;
  Music: number;
  Pictures: number;
  Documents: number;
  Other: number;
}

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
  categoryCounts: CategoryCounts;
  onOpenScheduler: () => void;
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  statusCounts,
  categoryCounts,
  onOpenScheduler,
}: SidebarProps) {
  // Load saved accordion states or use clean defaults: all collapsed by default
  const [accordionState, setAccordionState] = useState(() => {
    try {
      const saved = localStorage.getItem("rilo:sidebar-accordions");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return {
      all: false,
      finished: false,
      unfinished: false,
      queues: false,
    };
  });

  const isAllExpanded = accordionState.all ?? false;
  const isFinishedExpanded = accordionState.finished ?? false;
  const isUnfinishedExpanded = accordionState.unfinished ?? false;
  const isQueuesExpanded = accordionState.queues ?? false;

  const toggleAccordion = (key: "all" | "finished" | "unfinished" | "queues") => {
    setAccordionState((prev: any) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("rilo:sidebar-accordions", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const categoryItems: { id: CategoryTab; label: string; countKey: keyof CategoryCounts; icon: any }[] = [
    { id: "cat_Compressed", label: "Compressed", countKey: "Compressed", icon: Archive },
    { id: "cat_Programs", label: "Programs", countKey: "Programs", icon: Binary },
    { id: "cat_Videos", label: "Videos", countKey: "Videos", icon: Video },
    { id: "cat_Music", label: "Music", countKey: "Music", icon: Music },
    { id: "cat_Pictures", label: "Pictures", countKey: "Pictures", icon: ImageIcon },
    { id: "cat_Documents", label: "Documents", countKey: "Documents", icon: FileText },
    { id: "cat_Other", label: "Other", countKey: "Other", icon: Folder },
  ];

  return (
    <aside className="w-52 bg-rilo-surface border-r border-rilo-border flex flex-col justify-between select-none h-full font-sans flex-shrink-0">
      <div className="overflow-y-auto p-2 space-y-1.5 custom-scrollbar text-xs">
        {/* Accordion 1: All */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer group">
            <div
              className="flex items-center space-x-1.5 min-w-0 flex-1"
              onClick={() => onSelectTab("all")}
            >
              <Folder className="w-4 h-4 text-rilo-accent flex-shrink-0" />
              <span className="truncate group-hover:text-rilo-accent transition-colors">All</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-rilo-muted font-semibold">{statusCounts.all}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAccordion("all");
                }}
                className="p-0.5 text-rilo-muted hover:text-rilo-primary rounded transition-colors cursor-pointer"
                title={isAllExpanded ? "Collapse" : "Expand"}
              >
                {isAllExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isAllExpanded && (
            <div className="space-y-0.5 pl-4 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => onSelectTab("all")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer ${
                  activeTab === "all"
                    ? "bg-rilo-selected text-rilo-primary font-semibold border-l-2 border-rilo-accent shadow-xs"
                    : "text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary"
                }`}
              >
                <span className={activeTab === "all" ? "text-rilo-primary font-semibold" : ""}>All Downloads</span>
                <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.all}</span>
              </button>

              {categoryItems.map((cat) => {
                const isActive = activeTab === cat.id;
                const count = categoryCounts[cat.countKey] || 0;
                const Icon = cat.icon;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectTab(cat.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer group ${
                      isActive
                        ? "bg-rilo-selected text-rilo-primary font-semibold border-l-2 border-rilo-accent shadow-xs"
                        : "text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary"
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isActive ? "text-rilo-accent" : "text-rilo-muted group-hover:text-rilo-secondary"}`} />
                      <span className="truncate">{cat.label}</span>
                    </div>
                    {count > 0 && (
                      <span className={`text-[10px] font-mono ${isActive ? "text-rilo-primary font-semibold" : "text-rilo-muted"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Accordion 2: Finished */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer group">
            <div
              className="flex items-center space-x-1.5 min-w-0 flex-1"
              onClick={() => onSelectTab("completed")}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate group-hover:text-emerald-400 transition-colors">Finished</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.completed}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAccordion("finished");
                }}
                className="p-0.5 text-rilo-muted hover:text-rilo-primary rounded transition-colors cursor-pointer"
                title={isFinishedExpanded ? "Collapse" : "Expand"}
              >
                {isFinishedExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isFinishedExpanded && (
            <div className="space-y-0.5 pl-4 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => onSelectTab("completed")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer group ${
                  activeTab === "completed"
                    ? "bg-rilo-selected text-rilo-primary font-semibold border-l-2 border-emerald-400 shadow-xs"
                    : "text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === "completed" ? "text-emerald-400" : "text-rilo-muted group-hover:text-emerald-400"}`} />
                  <span>Completed Tasks</span>
                </div>
                <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.completed}</span>
              </button>
            </div>
          )}
        </div>

        {/* Accordion 3: Unfinished */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer group">
            <div
              className="flex items-center space-x-1.5 min-w-0 flex-1"
              onClick={() => onSelectTab("downloading")}
            >
              <Download className="w-4 h-4 text-rilo-accent flex-shrink-0" />
              <span className="truncate group-hover:text-rilo-accent transition-colors">Unfinished</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.downloading + statusCounts.paused + statusCounts.queued}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAccordion("unfinished");
                }}
                className="p-0.5 text-rilo-muted hover:text-rilo-primary rounded transition-colors cursor-pointer"
                title={isUnfinishedExpanded ? "Collapse" : "Expand"}
              >
                {isUnfinishedExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isUnfinishedExpanded && (
            <div className="space-y-0.5 pl-4 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => onSelectTab("downloading")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer group ${
                  activeTab === "downloading"
                    ? "bg-rilo-selected text-rilo-primary font-semibold border-l-2 border-rilo-accent shadow-xs"
                    : "text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Play className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === "downloading" ? "text-rilo-accent" : "text-rilo-muted group-hover:text-rilo-secondary"}`} />
                  <span>Downloading</span>
                </div>
                <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.downloading}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("paused")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer group ${
                  activeTab === "paused"
                    ? "bg-rilo-selected text-rilo-primary font-semibold border-l-2 border-amber-400 shadow-xs"
                    : "text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Pause className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === "paused" ? "text-amber-400" : "text-rilo-muted group-hover:text-amber-400"}`} />
                  <span>Paused</span>
                </div>
                <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.paused}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab("queued")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all duration-100 cursor-pointer group ${
                  activeTab === "queued"
                    ? "bg-rilo-selected text-rilo-primary font-semibold border-l-2 border-sky-400 shadow-xs"
                    : "text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === "queued" ? "text-sky-400" : "text-rilo-muted group-hover:text-sky-400"}`} />
                  <span>Queued</span>
                </div>
                <span className="text-[10px] font-mono text-rilo-muted">{statusCounts.queued}</span>
              </button>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-rilo-border/60" />

        {/* Accordion 4: Queues */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleAccordion("queues")}
            className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-rilo-primary hover:bg-rilo-elevated/60 rounded transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              {isQueuesExpanded ? <ChevronDown className="w-3.5 h-3.5 text-rilo-accent" /> : <ChevronRight className="w-3.5 h-3.5 text-rilo-muted" />}
              <Layers className="w-4 h-4 text-rilo-accent flex-shrink-0" />
              <span className="truncate">Queues</span>
            </div>
          </button>

          {isQueuesExpanded && (
            <div className="space-y-0.5 pl-4 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={onOpenScheduler}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-rilo-secondary hover:bg-rilo-elevated hover:text-rilo-primary transition-colors cursor-pointer"
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
