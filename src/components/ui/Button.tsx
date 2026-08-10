import { ComponentChildren, JSX } from "preact";
import { cn } from "../../utils/cn";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "secondary" | "danger" | "amber" | "emerald";
  size?: "sm" | "md" | "lg" | "icon";
  children?: ComponentChildren;
}

export function Button({
  variant = "default",
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

  const variants = {
    default: "bg-rilo-accent hover:bg-rilo-accent-hover text-white shadow-sm",
    secondary: "bg-rilo-elevated hover:bg-rilo-selected text-rilo-primary border border-rilo-border",
    outline: "border border-rilo-border bg-transparent hover:bg-rilo-elevated text-rilo-primary",
    ghost: "bg-transparent hover:bg-rilo-elevated text-rilo-secondary hover:text-rilo-primary",
    danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30",
    amber: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30",
    emerald: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  };

  const sizes = {
    sm: "h-7 px-2.5 text-[11px]",
    md: "h-8 px-3 text-xs",
    lg: "h-9 px-4 text-xs font-semibold",
    icon: "h-7 w-7 p-0 flex items-center justify-center",
  };

  return (
    <button
      disabled={disabled}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
