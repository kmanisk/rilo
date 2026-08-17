import { cn } from "../../utils/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, className, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "group relative inline-flex items-center w-[38px] h-[22px] min-w-[38px] min-h-[22px] max-w-[38px] max-h-[22px] p-0 flex-shrink-0 cursor-pointer rounded-xs border-2 box-border transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-rilo-accent disabled:opacity-40 disabled:cursor-not-allowed select-none overflow-hidden",
        checked
          ? "bg-rilo-accent border-rilo-border-strong shadow-xs"
          : "bg-rilo-elevated border-rilo-border hover:border-rilo-border-strong",
        className
      )}
    >
      {/* Minecraft-Bedrock Square / Rectangular Knob */}
      <span
        className={cn(
          "pointer-events-none inline-block w-[14px] h-[14px] min-w-[14px] min-h-[14px] max-w-[14px] max-h-[14px] box-border rounded-xs border transition-transform duration-150 ease-out",
          checked
            ? "translate-x-[18px] bg-white border-black/30 shadow-xs"
            : "translate-x-[2px] bg-rilo-surface border-rilo-border-strong shadow-2xs"
        )}
      />
    </button>
  );
}
