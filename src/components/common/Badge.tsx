interface BadgeProps {
  status: "downloading" | "paused" | "completed" | "error" | "cancelled" | "queued" | "reconnecting" | "restarting" | string;
  threads?: number;
}

export default function Badge({ status, threads }: BadgeProps) {
  const normalized = (status || "completed").toLowerCase();

  switch (normalized) {
    case "downloading":
    case "reconnecting":
    case "restarting":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 select-none tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span>RUNNING {threads ? `(${threads})` : ""}</span>
        </span>
      );

    case "paused":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>PAUSED</span>
        </span>
      );

    case "queued":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>QUEUED</span>
        </span>
      );

    case "completed":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>DONE</span>
        </span>
      );

    case "error":
    case "failed":
    case "cancelled":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>FAILED</span>
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 select-none">
          <span>{normalized.toUpperCase()}</span>
        </span>
      );
  }
}
