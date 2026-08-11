import { useState, useEffect } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { DownloadItem } from '../types';
import { formatBytes, formatEta } from '../utils';
import UnifiedSegmentProgressBar from './UnifiedSegmentProgressBar';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Checkbox } from './ui/Checkbox';
import { X, Play, Pause, Square, FileCheck, FolderOpen } from 'lucide-preact';

interface DownloadProgressModalProps {
  item: DownloadItem;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (item: DownloadItem) => void;
  onCancel: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

export default function DownloadProgressModal({
  item,
  onClose,
  onPause,
  onResume,
  onCancel,
  onOpenFile,
  onOpenFolder,
}: DownloadProgressModalProps) {
  const [activeTab, setActiveTab] = useState<'progress' | 'completion'>('progress');
  const [speedLimitKbps, setSpeedLimitKbps] = useState<number>(0);
  const [openOnComplete, setOpenOnComplete] = useState<boolean>(false);
  const [openFolderOnComplete, setOpenFolderOnComplete] = useState<boolean>(false);
  const [autoCloseWindow, setAutoCloseWindow] = useState<boolean>(false);
  const [postAction, setPostAction] = useState<string>('none');
  const [confirmationMsg, setConfirmationMsg] = useState<string>('');

  const statusLower = (item.status || '').toLowerCase();
  const isDownloading = statusLower === 'downloading' || statusLower === 'reconnecting' || statusLower === 'restarting';
  const isPaused = statusLower === 'paused' || statusLower === 'queued' || statusLower === 'error' || statusLower === 'failed' || statusLower === 'cancelled';
  const isCompleted = statusLower === 'completed';

  const progressPercent = item.totalBytes > 0
    ? Math.min(100, Math.max(0, (item.bytesDownloaded / item.totalBytes) * 100))
    : 0;

  const handleSpeedLimitChange = async (limitKbps: number) => {
    setSpeedLimitKbps(limitKbps);
    try {
      await invoke('set_speed_limit', {
        downloadId: item.id,
        speedLimit: limitKbps * 1024,
      });
      setConfirmationMsg(limitKbps > 0 ? `Speed limit set to ${limitKbps} KB/s` : 'Speed limit removed');
      setTimeout(() => setConfirmationMsg(''), 2000);
    } catch (err) {
      console.error('Failed setting speed limit:', err);
    }
  };

  useEffect(() => {
    if (isCompleted) {
      if (openOnComplete && item.savePath) {
        onOpenFile(item.savePath);
      } else if (openFolderOnComplete && item.savePath) {
        onOpenFolder(item.savePath);
      }
      if (autoCloseWindow) {
        setTimeout(() => onClose(), 1000);
      }
    }
  }, [item.status]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-3 sm:p-4 select-none font-sans animate-in fade-in duration-150">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header Titlebar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rilo-border bg-rilo-surface">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-rilo-accent flex items-center justify-center text-white font-black text-xs">
              R
            </div>
            <div>
              <h2 className="text-xs font-bold text-rilo-primary tracking-tight">Rilo Download Task</h2>
              <p className="text-[10px] text-rilo-muted font-mono truncate max-w-xs">{item.filename}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex border-b border-rilo-border bg-rilo-surface px-4 pt-2">
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'progress'
                ? 'border-rilo-accent text-rilo-accent font-semibold'
                : 'border-transparent text-rilo-secondary hover:text-rilo-primary'
            }`}
          >
            Transfer Status
          </button>
          <button
            onClick={() => setActiveTab('completion')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'completion'
                ? 'border-rilo-accent text-rilo-accent font-semibold'
                : 'border-transparent text-rilo-secondary hover:text-rilo-primary'
            }`}
          >
            Options & Actions
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'progress' ? (
            /* Tab 1: Progress & Stats */
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rilo-muted block">Current Status</span>
                  <span className="text-sm font-bold text-rilo-primary capitalize">{item.status}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rilo-muted block">Speed</span>
                  <span className="text-sm font-mono font-bold text-rilo-accent tabular-nums">
                    {isDownloading && item.speedBps > 0 ? `${formatBytes(item.speedBps)}/s` : '0 B/s'}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <UnifiedSegmentProgressBar
                  bytesDownloaded={item.bytesDownloaded}
                  totalBytes={item.totalBytes}
                  status={item.status}
                  segments={item.segments}
                  heightClassName="h-3"
                />
                <div className="flex justify-between text-[11px] font-mono text-rilo-secondary tabular-nums">
                  <span>{formatBytes(item.bytesDownloaded)} / {item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'Unknown'}</span>
                  <span className="font-bold text-rilo-primary">{progressPercent.toFixed(1)}%</span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2 bg-rilo-elevated p-3 rounded-lg border border-rilo-border font-mono text-xs">
                <div>
                  <span className="text-[10px] text-rilo-muted block">ETA</span>
                  <span className="font-semibold text-rilo-primary tabular-nums">
                    {isDownloading && item.etaSeconds ? formatEta(item.etaSeconds) : isCompleted ? 'Finished' : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-rilo-muted block">Active Connections</span>
                  <span className="font-semibold text-rilo-primary tabular-nums">{item.activeThreads || 4} threads</span>
                </div>
                <div>
                  <span className="text-[10px] text-rilo-muted block">Resumable</span>
                  <span className={item.resumable ? 'font-semibold text-emerald-400' : 'font-semibold text-rose-400'}>
                    {item.resumable ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-rilo-muted block">Save Location</span>
                  <span className="font-semibold text-rilo-primary truncate block text-[10px]" title={item.savePath}>
                    {item.savePath}
                  </span>
                </div>
              </div>

              {/* Speed Limiter Controller */}
              <div className="bg-rilo-elevated p-3 rounded-lg border border-rilo-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rilo-primary">Download Speed Limiter</span>
                  {confirmationMsg && <span className="text-[10px] text-rilo-accent font-mono">{confirmationMsg}</span>}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 500, 1024, 5120].map((limit) => (
                    <Button
                      key={limit}
                      type="button"
                      variant={speedLimitKbps === limit ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => handleSpeedLimitChange(limit)}
                      className="text-[11px]"
                    >
                      {limit === 0 ? 'Unlimited' : `${limit >= 1024 ? limit / 1024 + ' MB/s' : limit + ' KB/s'}`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Completion Options & Actions */
            <div className="space-y-4">
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-rilo-primary uppercase tracking-wider block">Automated On-Completion Rules</span>

                <label className="flex items-center space-x-2.5 text-xs text-rilo-primary cursor-pointer bg-rilo-elevated p-2.5 rounded-lg border border-rilo-border">
                  <Checkbox
                    checked={openOnComplete}
                    onChange={(e) => setOpenOnComplete((e.target as HTMLInputElement).checked)}
                  />
                  <span>Open downloaded file automatically when finished</span>
                </label>

                <label className="flex items-center space-x-2.5 text-xs text-rilo-primary cursor-pointer bg-rilo-elevated p-2.5 rounded-lg border border-rilo-border">
                  <Checkbox
                    checked={openFolderOnComplete}
                    onChange={(e) => setOpenFolderOnComplete((e.target as HTMLInputElement).checked)}
                  />
                  <span>Open target directory folder when finished</span>
                </label>

                <label className="flex items-center space-x-2.5 text-xs text-rilo-primary cursor-pointer bg-rilo-elevated p-2.5 rounded-lg border border-rilo-border">
                  <Checkbox
                    checked={autoCloseWindow}
                    onChange={(e) => setAutoCloseWindow((e.target as HTMLInputElement).checked)}
                  />
                  <span>Close this progress window when transfer completes</span>
                </label>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-rilo-border">
                <label className="text-xs font-semibold text-rilo-primary block">Post Download Action</label>
                <Select
                  value={postAction}
                  onChange={(e) => setPostAction((e.target as HTMLSelectElement).value)}
                >
                  <option value="none">None (Keep App Open)</option>
                  <option value="notify">Show Toast Notification</option>
                  <option value="sleep">System Sleep / Hibernate</option>
                  <option value="shutdown">Shutdown Computer</option>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-rilo-border bg-rilo-surface flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isDownloading && (
              <Button variant="amber" size="sm" onClick={() => onPause(item.id)} className="space-x-1">
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </Button>
            )}
            {isPaused && (
              <Button variant="emerald" size="sm" onClick={() => onResume(item)} className="space-x-1">
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </Button>
            )}
            {isCompleted && (
              <>
                <Button variant="emerald" size="sm" onClick={() => onOpenFile(item.savePath)} className="space-x-1">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Open File</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenFolder(item.savePath)} className="space-x-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Folder</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {!isCompleted && (
              <Button variant="danger" size="sm" onClick={() => onCancel(item.id)} className="space-x-1">
                <Square className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
