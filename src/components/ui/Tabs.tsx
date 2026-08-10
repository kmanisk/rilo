import { ComponentChildren } from "preact";
import { cn } from "../../utils/cn";

export interface TabsProps<T extends string> {
  tabs: { id: T; label: string; icon?: ComponentChildren }[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, activeTab, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn("flex space-x-1 border-b border-rilo-border p-1", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              isActive
                ? "bg-rilo-accent-muted text-rilo-accent border border-rilo-accent font-semibold"
                : "text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
