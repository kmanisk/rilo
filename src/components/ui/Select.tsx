import { JSX } from "preact";
import { cn } from "../../utils/cn";

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "flex h-8 w-full rounded-md border border-rilo-border bg-rilo-surface px-2.5 py-1 text-xs text-rilo-primary transition-colors focus-visible:outline-none focus-visible:border-rilo-accent cursor-pointer font-sans shadow-xs [&>option]:bg-rilo-surface [&>option]:text-rilo-primary",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
