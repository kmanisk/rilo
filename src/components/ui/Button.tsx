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
    "inline-flex items-center justify-center rounded-md font-medium transition-all duration-100 ease-out active:scale-[0.97] active:brightness-95 hover:brightness-105 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

  const variants = {
    default: "rilo-button-primary shadow-sm",
    secondary: "rilo-button-secondary",
    outline: "rilo-button-secondary",
    ghost: "rilo-button-toolbar",
    danger: "rilo-button-danger",
    amber: "rilo-button-warning",
    emerald: "rilo-button-success",
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
