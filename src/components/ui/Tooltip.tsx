import { ComponentChildren } from "preact";
import { cn } from "../../utils/cn";

export interface TooltipProps {
  content: string;
  children: ComponentChildren;
  className?: string;
  side?: "top" | "bottom" | "right" | "left";
}

export function Tooltip({ content, children, className, side = "top" }: TooltipProps) {
  const positionClasses = {
    top: "bottom-full mb-1.5 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-1.5 left-1/2 -translate-x-1/2",
    right: "left-full ml-1.5 top-1/2 -translate-y-1/2",
    left: "right-full mr-1.5 top-1/2 -translate-y-1/2",
  };

  return (
    <div className="relative group inline-flex items-center">
      {children}
      <div
        role="tooltip"
        className={cn(
          "absolute hidden group-hover:flex group-focus-within:flex flex-col px-2.5 py-1.5 bg-rilo-surface border border-rilo-border/80 rounded-md text-[11px] font-medium text-rilo-primary shadow-xl shadow-black/40 z-50 pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150 min-w-[140px] max-w-[280px] text-left leading-snug break-words",
          positionClasses[side],
          className
        )}
      >
        <span>{content}</span>
      </div>
    </div>
  );
}

