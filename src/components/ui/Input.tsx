import { JSX } from "preact";
import { cn } from "../../utils/cn";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-8 w-full rounded-md border border-rilo-border bg-rilo-elevated px-3 py-1 text-xs text-rilo-primary placeholder-rilo-muted transition-colors focus-visible:outline-none focus-visible:border-rilo-accent disabled:cursor-not-allowed disabled:opacity-50 select-text font-mono",
        className
      )}
      {...props}
    />
  );
}
