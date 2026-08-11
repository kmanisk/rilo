import { useState, useEffect } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Checkbox } from './ui/Checkbox';
import { AppearanceSettings, applyVisualSettings } from '../lib/settings/visual';
import { riloThemes } from '../lib/themes/themes';
import { Download, CalendarClock, Palette, X, RotateCcw, Check } from 'lucide-preact';

export interface AppConfig {
  version: number;
  download: {
    download_directory: string;
    max_concurrent_downloads: number;
    max_connections_per_download: number;
    retry_count: number;
    retry_delay_seconds: number;
    global_speed_limit_kbps: number;
    auto_start: boolean;
    auto_extract_archives?: boolean;
    delete_archive_after_extraction?: boolean;
  };
  scheduler: {
    schedule_enabled: boolean;
    start_time: string;
    stop_time: string;
    post_download_action: string;
  };
  appearance: AppearanceSettings;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

export { applyVisualSettings } from '../lib/settings/visual';

export function SettingsModal({ isOpen, onClose, setTheme }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'downloads' | 'scheduler' | 'appearance'>('downloads');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [persistedConfig, setPersistedConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadConfig() {
      try {
        const loadedConfig = await invoke<AppConfig>('get_app_config');
        setConfig(loadedConfig);
        setPersistedConfig(loadedConfig);
        applyVisualSettings(loadedConfig.appearance);
      } catch (err) {
        console.error('Failed loading app config:', err);
      }
    }
    loadConfig();
  }, [isOpen]);

  const updateLocalConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    applyVisualSettings(newConfig.appearance);
    emit("rilo-appearance-changed", newConfig.appearance).catch(() => {});
  };

  const handleSave = async () => {
    if (config) {
      try {
        await invoke('update_app_config', { config });
        setPersistedConfig(config);
        applyVisualSettings(config.appearance);
        emit("rilo-appearance-changed", config.appearance).catch(() => {});
      } catch (err) {
        console.error('Failed saving config on close:', err);
      }
    }
    onClose();
  };

  const handleCancel = () => {
    if (persistedConfig) {
      setConfig(persistedConfig);
      applyVisualSettings(persistedConfig.appearance);
      emit("rilo-appearance-changed", persistedConfig.appearance).catch(() => {});
    }
    onClose();
  };

  const handleResetDefaults = async () => {
    try {
      const defaultConfig = await invoke<AppConfig>('reset_app_config');
      setConfig(defaultConfig);
      setPersistedConfig(defaultConfig);
      applyVisualSettings(defaultConfig.appearance);
      emit("rilo-appearance-changed", defaultConfig.appearance).catch(() => {});
    } catch (err) {
      console.error('Failed resetting config:', err);
    }
  };

  if (!isOpen || !config) return null;

  const accents = [
    { id: 'indigo', name: 'Indigo', hex: '#6366f1' },
    { id: 'blue', name: 'Blue', hex: '#3b82f6' },
    { id: 'purple', name: 'Purple', hex: '#a855f7' },
    { id: 'emerald', name: 'Emerald', hex: '#10b981' },
    { id: 'orange', name: 'Orange', hex: '#f97316' },
    { id: 'rose', name: 'Rose', hex: '#f43f5e' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150 font-sans select-none">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl shadow-2xl w-full max-w-2xl h-[560px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-rilo-border bg-rilo-surface">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded bg-rilo-accent flex items-center justify-center text-white font-black text-xs shadow-sm">
              R
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-rilo-primary">Rilo Preferences</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body Split Pane */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Compact Settings Navigation Sidebar */}
          <div className="w-full sm:w-52 bg-rilo-surface border-b sm:border-b-0 sm:border-r border-rilo-border p-2.5 flex sm:flex-col space-x-1 sm:space-x-0 sm:space-y-1 overflow-x-auto sm:overflow-x-visible flex-shrink-0">
            <button
              onClick={() => setActiveTab('downloads')}
              className={`w-full flex items-start space-x-2.5 p-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'downloads'
                  ? 'bg-rilo-accent-muted text-rilo-accent border border-rilo-accent font-semibold'
                  : 'text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated'
              }`}
            >
              <Download className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <span className="font-semibold block">Downloads</span>
                <span className="text-[10px] text-rilo-muted block font-normal leading-tight">Download behavior</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('scheduler')}
              className={`w-full flex items-start space-x-2.5 p-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'scheduler'
                  ? 'bg-rilo-accent-muted text-rilo-accent border border-rilo-accent font-semibold'
                  : 'text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated'
              }`}
            >
              <CalendarClock className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <span className="font-semibold block">Scheduler</span>
                <span className="text-[10px] text-rilo-muted block font-normal leading-tight">Queue scheduling</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-start space-x-2.5 p-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'appearance'
                  ? 'bg-rilo-accent-muted text-rilo-accent border border-rilo-accent font-semibold'
                  : 'text-rilo-secondary hover:text-rilo-primary hover:bg-rilo-elevated'
              }`}
            >
              <Palette className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <span className="font-semibold block">Appearance</span>
                <span className="text-[10px] text-rilo-muted block font-normal leading-tight">Theme, fonts & colors</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-rilo-primary">
            {activeTab === 'downloads' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-rilo-secondary">Default Download Folder</label>
                  <Input
                    type="text"
                    value={config.download.download_directory}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      updateLocalConfig({
                        ...config,
                        download: { ...config.download, download_directory: val },
                      });
                    }}
                    placeholder="System Default Downloads"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-rilo-secondary">Max Simultaneous Downloads</label>
                    <Select
                      value={config.download.max_concurrent_downloads}
                      onChange={(e) => {
                        const val = parseInt((e.target as HTMLSelectElement).value, 10);
                        updateLocalConfig({
                          ...config,
                          download: { ...config.download, max_concurrent_downloads: val },
                        });
                      }}
                    >
                      <option value={1}>1 Task</option>
                      <option value={2}>2 Tasks</option>
                      <option value={3}>3 Tasks</option>
                      <option value={4}>4 Tasks (Recommended)</option>
                      <option value={8}>8 Tasks</option>
                      <option value={16}>16 Tasks (Maximum)</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-rilo-secondary">Connections per Download</label>
                    <Select
                      value={config.download.max_connections_per_download}
                      onChange={(e) => {
                        const val = parseInt((e.target as HTMLSelectElement).value, 10);
                        updateLocalConfig({
                          ...config,
                          download: { ...config.download, max_connections_per_download: val },
                        });
                      }}
                    >
                      <option value={1}>1 Segment (Single-thread)</option>
                      <option value={2}>2 Segments</option>
                      <option value={4}>4 Segments (Recommended)</option>
                      <option value={8}>8 Segments (High Speed)</option>
                      <option value={16}>16 Segments (Ultra Speed)</option>
                      <option value={32}>32 Segments (Max Rilo Engine Limit)</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-rilo-secondary">Auto Retry Attempts</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={config.download.retry_count}
                      onChange={(e) => {
                        const val = parseInt((e.target as HTMLInputElement).value, 10) || 0;
                        updateLocalConfig({
                          ...config,
                          download: { ...config.download, retry_count: val },
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-rilo-secondary">Retry Delay (Seconds)</label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={config.download.retry_delay_seconds}
                      onChange={(e) => {
                        const val = parseInt((e.target as HTMLInputElement).value, 10) || 5;
                        updateLocalConfig({
                          ...config,
                          download: { ...config.download, retry_delay_seconds: val },
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="bg-rilo-elevated border border-rilo-border p-3.5 rounded-lg space-y-3">
                  <span className="font-bold text-rilo-primary text-xs block">Archive Extraction Defaults</span>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <Checkbox
                      checked={config.download.auto_extract_archives || false}
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        updateLocalConfig({
                          ...config,
                          download: { ...config.download, auto_extract_archives: checked },
                        });
                      }}
                    />
                    <div>
                      <span className="font-semibold text-rilo-primary block">Automatically extract archives after download</span>
                      <span className="text-[11px] text-rilo-muted">Default setting for .zip, .7z, .tar, .rar downloads</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <Checkbox
                      checked={config.download.delete_archive_after_extraction || false}
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        updateLocalConfig({
                          ...config,
                          download: { ...config.download, delete_archive_after_extraction: checked },
                        });
                      }}
                    />
                    <div>
                      <span className="font-semibold text-rilo-primary block font-normal">Delete original archive after successful extraction</span>
                      <span className="text-[11px] text-rilo-muted">Only deletes archive file after 100% clean extraction</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'scheduler' && (
              <div className="space-y-5">
                <label className="flex items-center space-x-3 cursor-pointer bg-rilo-elevated border border-rilo-border p-3 rounded-lg">
                  <Checkbox
                    checked={config.scheduler.schedule_enabled}
                    onChange={(e) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      updateLocalConfig({
                        ...config,
                        scheduler: { ...config.scheduler, schedule_enabled: checked },
                      });
                    }}
                  />
                  <div>
                    <span className="font-semibold text-rilo-primary block">Enable Automated Queue Schedule</span>
                    <span className="text-[11px] text-rilo-muted">Automatically start and stop queue downloads at set hours</span>
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-rilo-secondary">Start Time (HH:MM)</label>
                    <Input
                      type="text"
                      value={config.scheduler.start_time}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        updateLocalConfig({
                          ...config,
                          scheduler: { ...config.scheduler, start_time: val },
                        });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-rilo-secondary">Stop Time (HH:MM)</label>
                    <Input
                      type="text"
                      value={config.scheduler.stop_time}
                      onChange={(e) => {
                        const val = (e.target as HTMLInputElement).value;
                        updateLocalConfig({
                          ...config,
                          scheduler: { ...config.scheduler, stop_time: val },
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-rilo-secondary">Post Download Completion Action</label>
                  <Select
                    value={config.scheduler.post_download_action}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      updateLocalConfig({
                        ...config,
                        scheduler: { ...config.scheduler, post_download_action: val },
                      });
                    }}
                  >
                    <option value="none">None (Keep app active)</option>
                    <option value="notify">Desktop Toast Notification</option>
                    <option value="sleep">System Sleep / Hibernate</option>
                    <option value="shutdown">System Shutdown</option>
                  </Select>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-rilo-secondary">Community Theme</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {riloThemes.map((theme) => {
                      const selected = (config.appearance.theme || 'rilo-default') === theme.id;
                      return <button key={theme.id} onClick={() => updateLocalConfig({ ...config, appearance: { ...config.appearance, theme: theme.id } })}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[11px] transition-colors ${selected ? 'border-rilo-accent bg-rilo-accent-muted text-rilo-primary' : 'border-rilo-border bg-rilo-surface text-rilo-secondary hover:bg-rilo-elevated'}`}>
                        <span className="flex gap-1" aria-hidden="true">{[theme.colors.background, theme.colors.surface, theme.colors.accent].map((color) => <i key={color} className="h-3 w-3 rounded-full border border-rilo-border" style={{ backgroundColor: color }} />)}</span>
                        <span className="truncate font-medium">{theme.name}</span>
                      </button>;
                    })}
                  </div>
                  <p className="text-[11px] text-rilo-muted">Themes control surfaces and text. Accent color remains a separate preference.</p>
                </div>
                {/* Font Family Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-rilo-secondary">Typography Font Family</label>
                  <Select
                    value={config.appearance.font_family}
                    onChange={(e) => {
                      const font = (e.target as HTMLSelectElement).value;
                      updateLocalConfig({
                        ...config,
                        appearance: { ...config.appearance, font_family: font },
                      });
                    }}
                  >
                    <option value="Inter">Inter (Clean System Modern)</option>
                    <option value="IBM Plex Sans">IBM Plex Sans (Industrial Precision)</option>
                    <option value="JetBrains Mono">JetBrains Mono (Developer Console)</option>
                    <option value="Iosevka">Iosevka (Compact Monospace)</option>
                    <option value="Roboto">Roboto (Standard Modern)</option>
                    <option value="Geist">Geist (Sleek Technical)</option>
                    <option value="System">Native OS Font</option>
                  </Select>
                </div>

                {/* Font Size Stepper */}
                <div className="bg-rilo-elevated border border-rilo-border p-3 rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-rilo-primary block text-xs">Application Font Size</span>
                    <span className="text-[11px] text-rilo-muted">Adjust text size between 12px and 20px (Default: 15px)</span>
                  </div>

                  <div className="flex items-center space-x-1.5 bg-rilo-surface border border-rilo-border px-2 py-1 rounded-md flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const current = config.appearance.font_size_px || 15;
                        if (current > 12) {
                          updateLocalConfig({
                            ...config,
                            appearance: { ...config.appearance, font_size_px: current - 1 },
                          });
                        }
                      }}
                      disabled={(config.appearance.font_size_px || 15) <= 12}
                      className="w-6 h-6 text-xs font-bold"
                      title="Decrease Font Size"
                    >
                      −
                    </Button>

                    <span className="text-xs font-bold text-rilo-primary font-mono w-14 text-center tabular-nums">
                      {config.appearance.font_size_px || 15} px
                    </span>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const current = config.appearance.font_size_px || 15;
                        if (current < 20) {
                          updateLocalConfig({
                            ...config,
                            appearance: { ...config.appearance, font_size_px: current + 1 },
                          });
                        }
                      }}
                      disabled={(config.appearance.font_size_px || 15) >= 20}
                      className="w-6 h-6 text-xs font-bold"
                      title="Increase Font Size"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Accent Palette Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-rilo-secondary">Accent Color Palette</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {accents.map((acc) => {
                      const isSelected = (config.appearance.accent_color || 'indigo').toLowerCase() === acc.id;
                      return (
                        <button
                          key={acc.id}
                          onClick={() => {
                            updateLocalConfig({
                              ...config,
                              appearance: { ...config.appearance, accent_color: acc.id },
                            });
                          }}
                          className={`flex flex-col items-center p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                            ? 'bg-rilo-elevated border-rilo-accent ring-2 ring-rilo-accent/40'
                              : 'bg-rilo-surface border-rilo-border hover:bg-rilo-elevated'
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-full mb-1.5 shadow-sm flex items-center justify-center text-white"
                            style={{ backgroundColor: acc.hex }}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-[10px] text-rilo-primary font-medium">{acc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Layout Density */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-rilo-secondary">Row Layout Density</label>
                  <Select
                    value={config.appearance.density || "comfortable"}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      updateLocalConfig({
                        ...config,
                        appearance: { ...config.appearance, density: val },
                      });
                    }}
                  >
                    <option value="compact">Compact (High Density)</option>
                    <option value="comfortable">Comfortable (Recommended)</option>
                    <option value="spacious">Spacious</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-rilo-border bg-rilo-surface flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleResetDefaults} className="space-x-1 text-rilo-muted">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Defaults</span>
          </Button>
          <Button variant="default" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
