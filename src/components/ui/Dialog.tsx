import { ComponentChildren } from "preact";
import { cn } from "../../utils/cn";
import { X } from "lucide-preact";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ComponentChildren;
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150 font-sans select-none">
      <div
        className={cn(
          "bg-rilo-surface border border-rilo-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]",
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-rilo-border bg-rilo-surface">
            <div>
              {title && <h2 className="text-xs sm:text-sm font-bold text-rilo-primary">{title}</h2>}
              {description && <p className="text-[10px] text-rilo-muted font-mono">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-rilo-secondary hover:text-rilo-primary transition-colors p-1 rounded hover:bg-rilo-elevated cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
