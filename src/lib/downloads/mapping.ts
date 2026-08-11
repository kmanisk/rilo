import { DownloadItem, DownloadProgressPayload, DownloadRecord, ExtractionProgressPayload } from "../../types";
import { generateDeterministicSegments } from "../../utils";
import { normalizeDownloadStatus } from "./status";

export function recordToDownloadItem(record: DownloadRecord): DownloadItem {
  const status = normalizeDownloadStatus(record.status);
  const activeThreads = record.threads || 4;
  return {
    id: record.id, url: record.url, redirectUrl: record.redirect_url, filename: record.filename,
    savePath: record.save_path, bytesDownloaded: record.downloaded_bytes, totalBytes: record.total_bytes,
    status, startTime: Number(record.created_at) * 1000 || Date.now(), speedBps: 0,
    activeThreads, resumable: record.resumable ?? true, etag: record.etag,
    lastModified: record.last_modified, mimeType: record.mime_type, createdAt: record.created_at,
    segments: generateDeterministicSegments(record.total_bytes, activeThreads, record.downloaded_bytes, status),
    autoExtract: record.auto_extract, extractDir: record.extract_dir,
    deleteArchiveAfterExtract: record.delete_archive_after_extract, extractionState: record.extraction_state as DownloadItem["extractionState"],
  };
}

export function progressToDownloadItem(payload: DownloadProgressPayload, previous?: DownloadItem): DownloadItem {
  const status = normalizeDownloadStatus(payload.status);
  const rawSpeed = payload.speed_bps || 0;
  const previousSpeed = previous?.speedBps || 0;
  const speedBps = status === "paused" || status === "completed" || rawSpeed === 0
    ? 0 : previousSpeed === 0 ? rawSpeed : Math.round(previousSpeed * 0.7 + rawSpeed * 0.3);
  const etaSeconds = speedBps > 0 && payload.total_bytes > payload.bytes_downloaded
    ? Math.round((payload.total_bytes - payload.bytes_downloaded) / speedBps) : payload.eta_seconds;
  let segments = Array.isArray(payload.segments) && payload.segments.length > 0 ? payload.segments : previous?.segments;
  if (!segments?.length && payload.total_bytes > 0) {
    segments = generateDeterministicSegments(payload.total_bytes, payload.active_threads || previous?.activeThreads || 4, payload.bytes_downloaded, status);
  } else if (segments?.length && (status === "paused" || status === "queued")) {
    segments = segments.map((segment) => ({ ...segment, state: "paused", current_speed_bps: 0 }));
  } else if (segments?.length && status === "completed") {
    segments = segments.map((segment) => ({ ...segment, state: "completed", progress_percent: 100, downloaded_bytes: segment.total_bytes || segment.downloaded_bytes, current_speed_bps: 0 }));
  }
  return {
    id: payload.download_id, url: previous?.url || "", redirectUrl: previous?.redirectUrl,
    filename: payload.filename || previous?.filename || "download.bin", savePath: payload.save_path || previous?.savePath || "",
    bytesDownloaded: payload.bytes_downloaded, totalBytes: payload.total_bytes, status, errorMessage: payload.error_message,
    startTime: previous?.startTime || Date.now(), speedBps, etaSeconds,
    activeThreads: payload.active_threads || previous?.activeThreads || 4, resumable: payload.resumable ?? previous?.resumable ?? true,
    etag: payload.etag || previous?.etag, lastModified: payload.last_modified || previous?.lastModified,
    mimeType: payload.mime_type || previous?.mimeType, createdAt: previous?.createdAt, segments,
    autoExtract: previous?.autoExtract, extractDir: previous?.extractDir,
    deleteArchiveAfterExtract: previous?.deleteArchiveAfterExtract, extractionState: previous?.extractionState,
  };
}

export function applyExtractionProgress(item: DownloadItem, payload: ExtractionProgressPayload): DownloadItem {
  return { ...item, extractionState: payload.state, extractionProgress: payload };
}
