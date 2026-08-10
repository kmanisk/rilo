import { cn } from "../../utils/cn";

export interface SeparatorProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function Separator({ orientation = "horizontal", className }: SeparatorProps) {
  return (
    <div
      className={cn(
        "bg-rilo-border flex-shrink-0",
        orientation === "horizontal" ? "h-px w-full my-2" : "w-px h-full mx-2",
        className
      )}
    />
  );
}
