interface ProgressBarProps {
  percent: number;
  status: string;
}

export default function ProgressBar({ percent, status }: ProgressBarProps) {
  const isCompleted = status === "completed";
  const isError = status === "error" || status === "cancelled" || status === "failed";
  const isPaused = status === "paused";

  return (
    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
      <div
        className={`h-full transition-[width] duration-200 ease-out ${
          isCompleted
            ? "bg-emerald-500"
            : isError
            ? "bg-rose-500"
            : isPaused
            ? "bg-amber-500"
            : "bg-indigo-500"
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
