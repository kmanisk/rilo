interface DownloadProgressProps {
  percent: number;
  status: string;
}

export default function DownloadProgress({ percent, status }: DownloadProgressProps) {
  const norm = status.toLowerCase();

  let barBg = "bg-rilo-accent";
  let isStriped = false;

  if (norm === "completed") {
    barBg = "bg-rilo-success";
  } else if (norm === "paused") {
    barBg = "bg-rilo-warning";
  } else if (norm === "failed" || norm === "error") {
    barBg = "bg-rilo-error";
  } else if (norm === "queued") {
    barBg = "bg-rilo-info";
    isStriped = true;
  } else if (norm === "downloading" || norm === "reconnecting" || norm === "restarting") {
    barBg = "bg-rilo-accent";
    isStriped = true;
  }

  return (
    <div className="w-full space-y-1">
      <div className="w-full h-3 bg-rilo-elevated rounded overflow-hidden border border-rilo-border p-0.5 relative shadow-inner">
        <div
          className={`h-full rounded-sm transition-all duration-300 ${barBg} ${isStriped ? "animate-stripes" : ""}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}
