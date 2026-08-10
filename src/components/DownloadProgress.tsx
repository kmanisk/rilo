interface DownloadProgressProps {
  percent: number;
  status: string;
}

export default function DownloadProgress({ percent, status }: DownloadProgressProps) {
  const norm = status.toLowerCase();

  let barBg = "bg-[#FF4D3D]";
  let isStriped = false;

  if (norm === "completed") {
    barBg = "bg-[#22C55E]";
  } else if (norm === "paused") {
    barBg = "bg-[#FACC15]";
  } else if (norm === "failed" || norm === "error") {
    barBg = "bg-[#EF4444]";
  } else if (norm === "queued") {
    barBg = "bg-[#3B82F6]";
    isStriped = true;
  } else if (norm === "downloading" || norm === "reconnecting" || norm === "restarting") {
    barBg = "bg-[#FF4D3D]";
    isStriped = true;
  }

  return (
    <div className="w-full space-y-1">
      <div className="w-full h-3 bg-[#1A1B1E] rounded overflow-hidden border border-zinc-800/80 p-0.5 relative shadow-inner">
        <div
          className={`h-full rounded-sm transition-all duration-300 ${barBg} ${isStriped ? "animate-stripes" : ""}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  );
}
