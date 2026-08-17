import { DownloadItem, SegmentProgressPayload } from "./types";

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "calculating...";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export function normalizeUrl(urlInput: string): string {
  let trimmed = urlInput.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

export function getFileNameFromUrl(urlStr: string): string {
  try {
    const normalized = normalizeUrl(urlStr);
    const url = new URL(normalized);
    const pathname = url.pathname;
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      return decodeURIComponent(segments[segments.length - 1]);
    }
  } catch {
    // fallback if URL parsing fails
  }
  return "download.bin";
}

export function isArchiveFilename(filename: string): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".zip") ||
    lower.endsWith(".rar") ||
    lower.endsWith(".7z") ||
    lower.endsWith(".tar") ||
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tgz") ||
    lower.endsWith(".tar.bz2") ||
    lower.endsWith(".tbz2") ||
    lower.endsWith(".tar.xz") ||
    lower.endsWith(".txz")
  );
}

export function getDomainFromUrl(urlStr: string): string {
  try {
    const normalized = normalizeUrl(urlStr);
    const url = new URL(normalized);
    return url.hostname || urlStr;
  } catch {
    return urlStr;
  }
}

export function getCategoryFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
    case "bz2":
    case "xz":
    case "iso":
    case "img":
    case "tgz":
    case "zst":
    case "cab":
    case "arj":
    case "lzh":
    case "ace":
    case "7-zip":
      return "Compressed";
    case "exe":
    case "msi":
    case "msix":
    case "appx":
    case "apk":
    case "deb":
    case "rpm":
    case "dmg":
    case "pkg":
    case "bin":
    case "bat":
    case "cmd":
    case "sh":
    case "app":
    case "ps1":
    case "reg":
      return "Programs";
    case "mp4":
    case "mkv":
    case "avi":
    case "mov":
    case "webm":
    case "flv":
    case "m4v":
    case "wmv":
    case "mpg":
    case "mpeg":
    case "3gp":
    case "ts":
      return "Videos";
    case "mp3":
    case "wav":
    case "aac":
    case "flac":
    case "ogg":
    case "m4a":
    case "opus":
    case "wma":
    case "alac":
      return "Music";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "bmp":
    case "tiff":
    case "tif":
    case "ico":
    case "psd":
    case "ai":
      return "Pictures";
    case "pdf":
    case "doc":
    case "docx":
    case "xls":
    case "xlsx":
    case "ppt":
    case "pptx":
    case "txt":
    case "csv":
    case "epub":
    case "rtf":
    case "odt":
    case "ods":
    case "odp":
    case "md":
    case "log":
    case "xml":
    case "json":
    case "yaml":
      return "Documents";
    default:
      return "Other";
  }
}

export function getFileIconLabel(filename: string): string {
  const ext = filename.split(".").pop()?.toUpperCase() || "BIN";
  return ext.length <= 4 ? ext : ext.substring(0, 3);
}

export interface DateGroupedDownloads {
  label: string;
  items: DownloadItem[];
}

export function groupDownloadsByDate(downloads: DownloadItem[]): DateGroupedDownloads[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const todayItems: DownloadItem[] = [];
  const yesterdayItems: DownloadItem[] = [];
  const thisWeekItems: DownloadItem[] = [];
  const earlierItems: DownloadItem[] = [];

  downloads.forEach((item) => {
    const time = item.startTime;
    if (time >= todayStart) {
      todayItems.push(item);
    } else if (time >= yesterdayStart) {
      yesterdayItems.push(item);
    } else if (time >= weekStart) {
      thisWeekItems.push(item);
    } else {
      earlierItems.push(item);
    }
  });

  const groups: DateGroupedDownloads[] = [];

  if (todayItems.length > 0) {
    groups.push({
      label: `Today — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      items: todayItems,
    });
  }
  if (yesterdayItems.length > 0) {
    const yestDate = new Date(yesterdayStart);
    groups.push({
      label: `Yesterday — ${yestDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      items: yesterdayItems,
    });
  }
  if (thisWeekItems.length > 0) {
    groups.push({
      label: "Earlier This Week",
      items: thisWeekItems,
    });
  }
  if (earlierItems.length > 0) {
    groups.push({
      label: "Earlier",
      items: earlierItems,
    });
  }

  return groups;
}

export function generateDeterministicSegments(
  totalBytes: number,
  threads: number,
  bytesDownloaded: number,
  status: string
): SegmentProgressPayload[] {
  if (totalBytes <= 0 || threads <= 0) return [];
  const numThreads = Math.min(32, Math.max(1, threads));
  const partSize = Math.floor(totalBytes / numThreads);
  const statusLower = (status || "").toLowerCase();
  const isCompleted = statusLower === "completed";
  const isPaused = statusLower === "paused" || statusLower === "queued";

  const globalProgressRatio = Math.min(1.0, Math.max(0.0, bytesDownloaded / totalBytes));

  const segments: SegmentProgressPayload[] = [];
  for (let i = 0; i < numThreads; i++) {
    const startByte = i * partSize;
    const endByte = i === numThreads - 1 ? totalBytes - 1 : (i + 1) * partSize - 1;
    const partTotal = endByte - startByte + 1;

    let partDownloaded = 0;
    if (isCompleted) {
      partDownloaded = partTotal;
    } else {
      partDownloaded = Math.min(partTotal, Math.round(partTotal * globalProgressRatio));
    }

    const pct = partTotal > 0 ? (partDownloaded / partTotal) * 100 : 0;

    let state = "pending";
    if (isCompleted || partDownloaded >= partTotal) {
      state = "completed";
    } else if (isPaused) {
      state = "paused";
    } else if (partDownloaded > 0) {
      state = "downloading";
    }

    segments.push({
      segment_id: i + 1,
      start_byte: startByte,
      end_byte: endByte,
      downloaded_bytes: partDownloaded,
      total_bytes: partTotal,
      progress_percent: Math.min(100, Math.max(0, pct)),
      current_speed_bps: 0,
      state,
    });
  }

  return segments;
}
