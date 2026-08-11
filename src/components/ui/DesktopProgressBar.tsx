import { normalizeDownloadStatus } from "../../lib/downloads/status";

interface DesktopProgressBarProps {
  percent: number;
  status: string;
  heightClassName?: string;
  className?: string;
  title?: string;
}

export default function DesktopProgressBar({
  percent,
  status,
  heightClassName = "h-2.5",
  className = "",
  title,
}: DesktopProgressBarProps) {
  const statusLower = (status || "").toLowerCase();
  const normalizedStatus = normalizeDownloadStatus(status);
  const normalizedPercent = Math.min(100, Math.max(0, percent || 0));

  let statusClass = "status-downloading";
  if (normalizedStatus === "completed") statusClass = "status-completed";
  else if (normalizedStatus === "paused") statusClass = "status-paused";
  else if (normalizedStatus === "error" || normalizedStatus === "cancelled" || statusLower.includes("fail")) statusClass = "status-error";
  else if (normalizedStatus === "queued") statusClass = "status-queued";

  return (
    <div
      className={`w-full ${heightClassName} rilo-xp-progress-track ${className}`}
      title={title || `${normalizedPercent.toFixed(1)}%`}
    >
      <div
        className={`rilo-xp-progress-fill ${statusClass}`}
        style={{ width: `${normalizedPercent}%` }}
      />
    </div>
  );
}
