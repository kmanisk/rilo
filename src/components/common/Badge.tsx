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
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rilo-accent-muted text-rilo-accent border border-rilo-accent/30 select-none tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-rilo-accent animate-pulse" />
          <span>RUNNING {threads ? `(${threads})` : ""}</span>
        </span>
      );

    case "paused":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>PAUSED</span>
        </span>
      );

    case "queued":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-500 border border-sky-500/30 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>QUEUED</span>
        </span>
      );

    case "completed":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>DONE</span>
        </span>
      );

    case "error":
    case "failed":
    case "cancelled":
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30 select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>FAILED</span>
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rilo-elevated text-rilo-secondary border border-rilo-border select-none">
          <span>{normalized.toUpperCase()}</span>
        </span>
      );
  }
}
