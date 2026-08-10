import { ComponentChildren } from "preact";
import { cn } from "../../utils/cn";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: ComponentChildren;
  onClick: () => void;
  danger?: boolean;
  amber?: boolean;
  emerald?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  items: (DropdownItem | { type: "separator" })[];
  className?: string;
  onClose?: () => void;
}

export function Dropdown({ items, className }: DropdownProps) {
  return (
    <div
      className={cn(
        "bg-rilo-surface border border-rilo-border rounded-lg shadow-2xl py-1 text-xs text-rilo-primary font-sans select-none animate-in fade-in duration-100 min-w-[180px]",
        className
      )}
    >
      {items.map((item, i) => {
        if ("type" in item && item.type === "separator") {
          return <div key={i} className="h-px bg-rilo-border my-1" />;
        }
        const menuItem = item as DropdownItem;
        return (
          <button
            key={menuItem.id}
            disabled={menuItem.disabled}
            onClick={() => {
              if (!menuItem.disabled) menuItem.onClick();
            }}
            className={cn(
              "w-full text-left px-3 py-1.5 hover:bg-rilo-elevated flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
              menuItem.danger && "text-rose-400 font-medium",
              menuItem.amber && "text-amber-400 font-medium",
              menuItem.emerald && "text-emerald-400 font-medium"
            )}
          >
            {menuItem.icon}
            <span>{menuItem.label}</span>
          </button>
        );
      })}
    </div>
  );
}
