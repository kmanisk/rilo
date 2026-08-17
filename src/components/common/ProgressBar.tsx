interface ProgressBarProps {
  percent: number;
  status: string;
}

export default function ProgressBar({ percent, status }: ProgressBarProps) {
  const isCompleted = status === "completed";
  const isError = status === "error" || status === "cancelled" || status === "failed";
  const isPaused = status === "paused";

  return (
    <div className="w-full h-1 bg-rilo-elevated rounded-full overflow-hidden border border-rilo-border">
      <div
        className={`h-full transition-[width] duration-200 ease-out ${
          isCompleted
            ? "bg-rilo-success"
            : isError
            ? "bg-rilo-error"
            : isPaused
            ? "bg-rilo-warning"
            : "bg-rilo-accent"
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
