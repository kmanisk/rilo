export interface DownloadRecord {
  id: string;
  filename: string;
  url: string;
  redirect_url?: string;
  save_path: string;
  total_bytes: number;
  downloaded_bytes: number;
  status: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  threads?: number;
  etag?: string;
  last_modified?: string;
  mime_type?: string;
  accept_ranges?: string;
  resumable?: boolean;
  retry_count?: number;
  auto_extract?: boolean;
  extract_dir?: string;
  delete_archive_after_extract?: boolean;
  extraction_state?: string;
}

export interface SegmentProgressPayload {
  segment_id: number;
  start_byte: number;
  end_byte: number;
  downloaded_bytes: number;
  total_bytes: number;
  progress_percent: number;
  current_speed_bps: number;
  state: string;
}

export interface ExtractionProgressPayload {
  download_id: string;
  state: "Pending" | "Extracting" | "Extracted" | "ExtractionFailed" | "Cancelled";
  progress_percent: number;
  extracted_files: number;
  total_files: number;
  current_file: string;
  error_message?: string;
}

export interface ArchiveInfo {
  filename: string;
  format: string;
  is_supported: boolean;
  total_files: number;
  uncompressed_size: number;
  is_encrypted: boolean;
}

export interface DownloadProgressPayload {
  download_id: string;
  bytes_downloaded: number;
  total_bytes: number;
  status: "downloading" | "paused" | "completed" | "error" | "cancelled" | "queued" | "reconnecting" | "restarting";
  error_message?: string;
  filename: string;
  save_path: string;
  speed_bps: number;
  eta_seconds?: number;
  active_threads?: number;
  resumable?: boolean;
  etag?: string;
  last_modified?: string;
  mime_type?: string;
  segments?: SegmentProgressPayload[];
}

export interface DownloadItem {
  id: string;
  url: string;
  redirectUrl?: string;
  filename: string;
  savePath: string;
  bytesDownloaded: number;
  totalBytes: number;
  status: "downloading" | "paused" | "completed" | "error" | "cancelled" | "queued" | "reconnecting" | "restarting";
  errorMessage?: string;
  startTime: number;
  speedBps: number;
  etaSeconds?: number;
  activeThreads: number;
  resumable: boolean;
  etag?: string;
  lastModified?: string;
  mimeType?: string;
  createdAt?: string;
  segments?: SegmentProgressPayload[];
  autoExtract?: boolean;
  extractDir?: string;
  deleteArchiveAfterExtract?: boolean;
  extractionState?: "Pending" | "Extracting" | "Extracted" | "ExtractionFailed" | "Cancelled";
  extractionProgress?: ExtractionProgressPayload;
}

export interface DuplicateDownloadInfo {
  id: string;
  filename: string;
  url: string;
  status: string;
  save_path: string;
  downloaded_bytes: number;
  total_bytes: number;
  file_exists_on_disk: boolean;
}

export interface UrlMetadata {
  size?: number | null;
  filename?: string | null;
  content_type?: string | null;
  accept_ranges: boolean;
  resumable: boolean;
}
