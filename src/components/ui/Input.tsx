import { JSX } from "preact";
import { cn } from "../../utils/cn";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "rilo-input flex h-8 w-full rounded-md border px-3 py-1 text-xs transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 select-text font-mono",
        className
      )}
      {...props}
    />
  );
}
