import { JSX } from "preact";
import { cn } from "../../utils/cn";

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "rilo-input flex h-8 w-full rounded-md border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none cursor-pointer font-sans shadow-xs [&>option]:bg-rilo-surface [&>option]:text-rilo-primary",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
