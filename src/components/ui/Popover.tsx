import { ComponentChildren } from "preact";
import { cn } from "../../utils/cn";

export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: ComponentChildren;
  className?: string;
}

export function Popover({ isOpen, onClose, children, className }: PopoverProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cn(
          "absolute z-50 bg-rilo-surface border border-rilo-border rounded-lg shadow-2xl p-3 text-xs text-rilo-primary font-sans select-none animate-in fade-in duration-150",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}
