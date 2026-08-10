import { ComponentChildren } from "preact";
import { cn } from "../../utils/cn";

export interface TooltipProps {
  content: string;
  children: ComponentChildren;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <div className="relative group inline-block">
      {children}
      <div
        className={cn(
          "absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block px-2 py-1 bg-rilo-surface border border-rilo-border rounded text-[10px] text-rilo-primary shadow-lg whitespace-nowrap pointer-events-none z-50 animate-in fade-in duration-100",
          className
        )}
      >
        {content}
      </div>
    </div>
  );
}
