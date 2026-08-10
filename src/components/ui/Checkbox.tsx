import { JSX } from "preact";
import { cn } from "../../utils/cn";

export interface CheckboxProps extends JSX.HTMLAttributes<HTMLInputElement> {
  checked?: boolean;
}

export function Checkbox({ className, checked, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      className={cn(
        "h-4 w-4 rounded border-rilo-border bg-rilo-elevated accent-indigo-600 focus:ring-rilo-accent cursor-pointer",
        className
      )}
      {...props}
    />
  );
}
