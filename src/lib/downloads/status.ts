import { DownloadItem } from "../../types";

export type DownloadStatus = DownloadItem["status"];

export function normalizeDownloadStatus(status: string | null | undefined): DownloadStatus {
  const normalized = (status || "completed").trim().toLowerCase();
  const known: DownloadStatus[] = ["downloading", "paused", "completed", "error", "cancelled", "queued", "reconnecting", "restarting"];
  return known.includes(normalized as DownloadStatus) ? (normalized as DownloadStatus) : "error";
}

export function isActiveDownload(status: string | null | undefined) {
  const normalized = normalizeDownloadStatus(status);
  return normalized === "downloading" || normalized === "reconnecting" || normalized === "restarting";
}

export function isResumableStatus(status: string | null | undefined) {
  const normalized = normalizeDownloadStatus(status);
  return normalized === "paused" || normalized === "queued" || normalized === "error" || normalized === "cancelled";
}
