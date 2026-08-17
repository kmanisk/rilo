import { useState, useEffect, useRef } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Switch } from './ui/Switch';
import { Tooltip } from './ui/Tooltip';
import { AppearanceSettings, applyVisualSettings, getSystemAppearance } from '../lib/settings/visual';
import { riloThemes, getDarkThemes, getLightThemes } from '../lib/themes/themes';
import {
  Palette,
  CloudDownload,
  ArrowLeftRight,
  RotateCcw,
  FolderOpen,
  Settings as SettingsIcon,
  X,
  Key,
  Globe,
  CalendarClock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-preact';

export interface SiteCredential {
  id: string;
  domain: string;
  protocol: string;
  username: string;
  password: string;
  enabled: boolean;
  created_at: string;
  last_used_at?: string;
  notes?: string;
}

export interface ProxyConfig {
  mode: string;
  http_proxy?: string;
  https_proxy?: string;
  no_proxy?: string;
  username?: string;
  password?: string;
}

export interface AppConfig {
  version: number;
  download: {
    download_directory: string;
    max_concurrent_downloads: number;
    max_connections_per_download: number;
    retry_count: number;
    retry_delay_seconds: number;
    connection_timeout_seconds: number;
    global_speed_limit_kbps: number;
    auto_start: boolean;
    auto_extract_archives?: boolean;
    delete_archive_after_extraction?: boolean;
    use_category_by_default?: boolean;
    dynamic_part_creation?: boolean;
    default_user_agent?: string;
    ignore_ssl_certificates?: boolean;
    use_server_last_modified?: boolean;
    track_deleted_files?: boolean;
    append_extension_incomplete?: boolean;
    delete_partial_on_cancel?: boolean;
    sparse_file_allocation?: boolean;
    check_disk_space?: boolean;
    proxy: ProxyConfig;
  };
  scheduler: {
    schedule_enabled: boolean;
    start_time: string;
    stop_time: string;
    active_days: string[];
    post_download_action: string;
    custom_command?: string;
  };
  browser?: {
    enabled?: boolean;
    port?: number;
    use_api_key?: boolean;
    api_key?: string;
  };
  appearance: AppearanceSettings;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  setTheme?: (t: 'dark' | 'light') => void;
}

function SettingRow({
  label,
  subtext,
  tooltip,
  children,
}: {
  label: string;
  subtext?: string;
  tooltip?: string;
  children: preact.ComponentChildren;
}) {
  return (
    <div className={`flex justify-between gap-4 py-3 min-h-[44px] ${subtext ? 'items-start' : 'items-center'}`}>
      <div className="space-y-0.5 min-w-0 pr-2 flex-1 break-words">
        <div className="flex items-center space-x-1.5 leading-none">
          <span className="text-xs font-semibold text-rilo-primary tracking-tight leading-normal break-words">{label}</span>
          {tooltip && (
            <Tooltip content={tooltip} side="top">
              <span
                className="text-[10px] text-rilo-muted hover:text-rilo-primary hover:border-rilo-accent/50 cursor-help border border-rilo-subtle rounded-full w-3.5 h-3.5 inline-flex items-center justify-center font-mono shrink-0 select-none transition-colors"
                title={tooltip}
              >
                ?
              </span>
            </Tooltip>
          )}
        </div>
        {subtext && <p className="text-[11px] text-rilo-muted leading-relaxed mt-0.5 break-words">{subtext}</p>}
      </div>
      <div className={`flex items-center justify-end shrink-0 ${subtext ? 'pt-0.5' : ''}`}>
        {children}
      </div>
    </div>
  );
}

function SettingsGroup({ children }: { children: preact.ComponentChildren }) {
  return (
    <div className="bg-rilo-elevated border border-rilo-border/40 rounded-xl px-4 py-1.5 space-y-0.5 shadow-xs mb-4">
      {children}
    </div>
  );
}

function SwitchToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return <Switch checked={checked} onChange={onChange} disabled={disabled} />;
}

let cachedAppConfig: AppConfig | null = null;

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'downloads' | 'proxy' | 'credentials' | 'scheduler' | 'browser'>('appearance');
  const [config, setConfig] = useState<AppConfig | null>(() => cachedAppConfig);
  const [persistedConfig, setPersistedConfig] = useState<AppConfig | null>(() => cachedAppConfig);

  // Site Credentials State
  const [credentials, setCredentials] = useState<SiteCredential[]>([]);
  const [showAddCredModal, setShowAddCredModal] = useState(false);
  const [credDomain, setCredDomain] = useState('');
  const [credUser, setCredUser] = useState('');
  const [credPass, setCredPass] = useState('');

  // Proxy Test State
  const [proxyTestStatus, setProxyTestStatus] = useState<string | null>(null);
  const [testingProxy, setTestingProxy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function loadConfig() {
      try {
        const loadedConfig = await invoke<AppConfig>('get_app_config');
        cachedAppConfig = loadedConfig;
        if (isMounted) {
          setConfig(loadedConfig);
          setPersistedConfig(loadedConfig);
          applyVisualSettings(loadedConfig.appearance);
        }
      } catch (err) {
        console.error('Failed loading app config:', err);
        if (isMounted && !config && !cachedAppConfig) {
          try {
            const fallback = await invoke<AppConfig>('reset_app_config');
            cachedAppConfig = fallback;
            if (isMounted) {
              setConfig(fallback);
              setPersistedConfig(fallback);
              applyVisualSettings(fallback.appearance);
            }
          } catch (resetErr) {
            console.error('Fallback config reset failed:', resetErr);
          }
        }
      }
    }

    async function loadCreds() {
      try {
        const creds = await invoke<SiteCredential[]>('get_site_credentials');
        if (isMounted) {
          setCredentials(creds);
        }
      } catch (err) {
        console.error('Failed loading site credentials:', err);
      }
    }

    loadConfig();
    loadCreds();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const updateLocalConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    applyVisualSettings(newConfig.appearance);
    emit('rilo-appearance-changed', newConfig.appearance).catch(() => {});
  };

  const handleSave = async () => {
    try {
      if (config) {
        await invoke('update_app_config', { config });
        cachedAppConfig = config;
        setPersistedConfig(config);
        applyVisualSettings(config.appearance);
        emit('rilo-appearance-changed', config.appearance).catch(() => {});
      }
    } catch (err) {
      console.error('Failed saving config:', err);
    } finally {
      onClose();
    }
  };

  const handleCancel = () => {
    try {
      if (persistedConfig) {
        setConfig(persistedConfig);
        applyVisualSettings(persistedConfig.appearance);
        emit('rilo-appearance-changed', persistedConfig.appearance).catch(() => {});
      }
    } catch (err) {
      console.error('Failed cancelling config:', err);
    } finally {
      onClose();
    }
  };

  const [focusedPane, setFocusedPane] = useState<'sidebar' | 'content'>('sidebar');
  const sidebarRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFocusedPane('sidebar');
    }
  }, [isOpen]);

  const getFocusableControls = () => {
    if (!contentRef.current) return [];
    return Array.from(
      contentRef.current.querySelectorAll<HTMLElement>(
        'select, input:not([type="hidden"]), button, textarea, [role="switch"]'
      )
    ).filter(
      (el) =>
        !el.hasAttribute('disabled') &&
        el.tabIndex !== -1 &&
        el.offsetParent !== null
    );
  };

  // Two-Pane Vim (j/k/h/l) & Arrow Key Navigation for Settings
  useEffect(() => {
    if (!isOpen) return;

    const tabs: Array<'appearance' | 'downloads' | 'proxy' | 'credentials' | 'scheduler' | 'browser'> = [
      'appearance',
      'downloads',
      'proxy',
      'credentials',
      'scheduler',
      'browser',
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape handling
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showAddCredModal) {
          setShowAddCredModal(false);
          return;
        }
        if (focusedPane === 'content') {
          setFocusedPane('sidebar');
          (document.activeElement as HTMLElement)?.blur();
          return;
        }
        handleCancel();
        return;
      }

      // Ctrl+S / Cmd+S: Quick Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      const isTextInput =
        (activeEl instanceof HTMLInputElement && (activeEl.type === 'text' || activeEl.type === 'password' || activeEl.type === 'number')) ||
        activeEl instanceof HTMLTextAreaElement;

      // Direct Tab Jump with numbers 1..6 (when not typing inside a text field)
      if (!isTextInput && e.key >= '1' && e.key <= '6') {
        const tabIndex = parseInt(e.key, 10) - 1;
        if (tabs[tabIndex]) {
          e.preventDefault();
          setActiveTab(tabs[tabIndex]);
          setFocusedPane('sidebar');
          return;
        }
      }

      // -------------------------------------------------------------
      // SIDEBAR PANE NAVIGATION (left tab list)
      // -------------------------------------------------------------
      if (focusedPane === 'sidebar') {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          const currentIndex = tabs.indexOf(activeTab);
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTab(tabs[nextIndex]);
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          const currentIndex = tabs.indexOf(activeTab);
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          setActiveTab(tabs[prevIndex]);
        } else if (e.key === 'l' || e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          setFocusedPane('content');
          setTimeout(() => {
            const controls = getFocusableControls();
            if (controls.length > 0) {
              controls[0].focus();
            }
          }, 30);
        }
        return;
      }

      // -------------------------------------------------------------
      // CONTENT PANE NAVIGATION (right settings area)
      // -------------------------------------------------------------
      if (focusedPane === 'content') {
        const controls = getFocusableControls();
        const currentIdx = activeEl ? controls.indexOf(activeEl) : -1;

        // If typing in a text field, preserve standard cursor navigation
        if (isTextInput) {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (currentIdx !== -1 && currentIdx < controls.length - 1) {
              controls[currentIdx + 1].focus();
            } else {
              handleSave();
            }
          }
          return;
        }

        // 'h' or 'ArrowLeft' to exit back outside to the sidebar
        if (e.key === 'h' || e.key === 'ArrowLeft') {
          if (e.key === 'h' || activeEl?.tagName !== 'SELECT') {
            e.preventDefault();
            setFocusedPane('sidebar');
            activeEl?.blur();
            return;
          }
        }

        // 'j' / 'ArrowDown': Move to next setting control
        if (e.key === 'j' || e.key === 'ArrowDown') {
          if (e.key === 'j' || activeEl?.tagName !== 'SELECT') {
            e.preventDefault();
            if (currentIdx !== -1 && currentIdx < controls.length - 1) {
              controls[currentIdx + 1].focus();
            } else if (currentIdx === -1 && controls.length > 0) {
              controls[0].focus();
            }
          }
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
          // 'k' / 'ArrowUp': Move to previous setting control
          if (e.key === 'k' || activeEl?.tagName !== 'SELECT') {
            e.preventDefault();
            if (currentIdx > 0) {
              controls[currentIdx - 1].focus();
            } else if (currentIdx === 0 || currentIdx === -1) {
              setFocusedPane('sidebar');
              activeEl?.blur();
            }
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (activeEl?.tagName === 'BUTTON' || activeEl?.getAttribute('role') === 'switch') {
            // Handled natively by button / switch
          } else if (activeEl?.tagName !== 'SELECT') {
            e.preventDefault();
            handleSave();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, focusedPane, showAddCredModal, config, persistedConfig]);

  const handleResetDefaults = async () => {
    try {
      const defaultConfig = await invoke<AppConfig>('reset_app_config');
      cachedAppConfig = defaultConfig;
      setConfig(defaultConfig);
      setPersistedConfig(defaultConfig);
      applyVisualSettings(defaultConfig.appearance);
      emit('rilo-appearance-changed', defaultConfig.appearance).catch(() => {});
    } catch (err) {
      console.error('Failed resetting config:', err);
    }
  };

  const handlePickFolder = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string' && config) {
        setConfig({
          ...config,
          download: {
            ...config.download,
            download_directory: selected,
          },
        });
      }
    } catch (err) {
      console.error('Directory selection error:', err);
    }
  };

  const handleSaveCred = async () => {
    if (!credDomain.trim() || !credUser.trim()) return;
    const newCred: SiteCredential = {
      id: `cred_${Date.now()}`,
      domain: credDomain.trim(),
      protocol: 'any',
      username: credUser.trim(),
      password: credPass,
      enabled: true,
      created_at: new Date().toISOString(),
    };
    try {
      await invoke('save_site_credential', { cred: newCred });
      const updated = await invoke<SiteCredential[]>('get_site_credentials');
      setCredentials(updated);
      setShowAddCredModal(false);
      setCredDomain('');
      setCredUser('');
      setCredPass('');
    } catch (err) {
      console.error('Failed saving site credential:', err);
    }
  };

  const handleDeleteCred = async (id: string) => {
    try {
      await invoke('delete_site_credential', { id });
      setCredentials(credentials.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed deleting credential:', err);
    }
  };

  const handleTestProxy = async () => {
    if (!config?.download.proxy.http_proxy) return;
    setTestingProxy(true);
    setProxyTestStatus(null);
    try {
      const success = await invoke<boolean>('test_proxy_connection', {
        proxyUrl: config.download.proxy.http_proxy,
      });
      setProxyTestStatus(success ? 'Proxy connection test succeeded!' : 'Proxy connection test failed.');
    } catch (err: any) {
      setProxyTestStatus(`Error: ${err}`);
    } finally {
      setTestingProxy(false);
    }
  };

  if (!isOpen) return null;

  if (!config) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-4 select-none">
        <div className="bg-rilo-surface border border-rilo-border/60 rounded-xl rilo-modal-shadow w-[860px] max-w-[95vw] h-[580px] max-h-[90vh] flex flex-col overflow-hidden font-sans text-rilo-primary">
          <div className="px-5 py-3 border-b border-rilo-border/50 bg-rilo-surface flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2">
              <SettingsIcon className="w-4 h-4 text-rilo-accent animate-spin" />
              <h2 className="text-sm font-bold text-rilo-primary">Settings</h2>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center text-rilo-muted text-xs">
            Loading configuration...
          </div>
        </div>
      </div>
    );
  }

  const currentMode = (config.appearance.mode || 'system').toLowerCase();
  const effectiveMode = currentMode === 'system' ? getSystemAppearance() : (currentMode as 'dark' | 'light');

  const darkThemes = getDarkThemes();
  const lightThemes = getLightThemes();

  const daysList = [
    { id: 'mon', name: 'Mon' },
    { id: 'tue', name: 'Tue' },
    { id: 'wed', name: 'Wed' },
    { id: 'thu', name: 'Thu' },
    { id: 'fri', name: 'Fri' },
    { id: 'sat', name: 'Sat' },
    { id: 'sun', name: 'Sun' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-rilo-overlay backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-rilo-surface border border-rilo-border/60 rounded-xl rilo-modal-shadow w-[860px] max-w-[95vw] h-[580px] max-h-[90vh] flex flex-col overflow-hidden font-sans text-rilo-primary">
        {/* Header */}
        <div className="px-5 py-3 border-b border-rilo-border/50 bg-rilo-surface flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="w-4 h-4 text-rilo-accent" />
            <h2 className="text-sm font-bold text-rilo-primary">Settings</h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-colors p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Layout: Sidebar + Main Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar */}
          <aside ref={sidebarRef as any} className="w-52 h-full bg-rilo-surface border-r border-rilo-border/50 p-2.5 flex flex-col flex-shrink-0 overflow-y-auto custom-scrollbar">
            <nav className="space-y-1 font-sans text-xs">
              {[
                { id: 'appearance', label: 'Appearance', icon: Palette },
                { id: 'downloads', label: 'Download Engine', icon: CloudDownload },
                { id: 'proxy', label: 'Proxy & Network', icon: Globe },
                { id: 'credentials', label: 'Saved Logins', icon: Key },
                { id: 'scheduler', label: 'Scheduler', icon: CalendarClock },
                { id: 'browser', label: 'Browser Integration', icon: ArrowLeftRight },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setFocusedPane('sidebar');
                    }}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md font-medium text-left transition-all duration-100 cursor-pointer focus:outline-none ${
                      isActive
                        ? focusedPane === 'sidebar'
                          ? 'bg-rilo-selected text-rilo-primary border-l-2 border-rilo-accent font-semibold shadow-xs ring-1 ring-rilo-accent/50'
                          : 'bg-rilo-selected text-rilo-primary border-l-2 border-rilo-accent font-semibold shadow-xs opacity-90'
                        : 'text-rilo-secondary border-l-2 border-transparent hover:text-rilo-primary hover:bg-rilo-elevated'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-rilo-accent' : 'text-rilo-muted'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Scrollable Content */}
          <main ref={contentRef as any} className="flex-1 h-full min-h-0 p-5 overflow-y-auto custom-scrollbar bg-rilo-bg">
            {/* TAB 1: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div>
                <SettingsGroup>
                  <SettingRow label="Theme" tooltip="Choose Light, Dark, or follow your system's appearance automatically.">
                    <Select
                      value={config.appearance.mode || 'system'}
                      onChange={(e) => {
                        const newMode = (e.target as HTMLSelectElement).value;
                        let targetTheme = config.appearance.theme;
                        if (newMode === 'light') {
                          targetTheme = config.appearance.default_light_theme || 'github-light';
                        } else if (newMode === 'dark') {
                          targetTheme = config.appearance.default_dark_theme || 'rilo-default';
                        }
                        updateLocalConfig({
                          ...config,
                          appearance: {
                            ...config.appearance,
                            mode: newMode,
                            theme: targetTheme,
                          },
                        });
                      }}
                      className="w-44"
                    >
                      <option value="system">System</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </Select>
                  </SettingRow>

                  {(currentMode === 'system' || effectiveMode === 'dark') && (
                    <SettingRow label="Default Dark Theme" tooltip="Select the dark theme variant (only applies when Theme = Dark).">
                      <Select
                        value={config.appearance.default_dark_theme || config.appearance.theme || 'rilo-default'}
                        onChange={(e) => {
                          const darkThemeId = (e.target as HTMLSelectElement).value;
                          updateLocalConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              default_dark_theme: darkThemeId,
                              theme: effectiveMode === 'dark' ? darkThemeId : config.appearance.theme,
                            },
                          });
                        }}
                        className="w-44"
                      >
                        {darkThemes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </SettingRow>
                  )}

                  {(currentMode === 'system' || effectiveMode === 'light') && (
                    <SettingRow label="Default Light Theme" tooltip="Select the light theme variant (only applies when Theme = Light).">
                      <Select
                        value={config.appearance.default_light_theme || 'github-light'}
                        onChange={(e) => {
                          const lightThemeId = (e.target as HTMLSelectElement).value;
                          updateLocalConfig({
                            ...config,
                            appearance: {
                              ...config.appearance,
                              default_light_theme: lightThemeId,
                              theme: effectiveMode === 'light' ? lightThemeId : config.appearance.theme,
                            },
                          });
                        }}
                        className="w-44"
                      >
                        {lightThemes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </SettingRow>
                  )}
                </SettingsGroup>

                <SettingsGroup>
                  <SettingRow label="Language" tooltip="Change the display language of the interface.">
                    <Select
                      value={config.appearance.language || 'system'}
                      onChange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, language: val },
                        });
                      }}
                      className="w-48"
                    >
                      <option value="system">System (English)</option>
                    </Select>
                  </SettingRow>

                  <SettingRow label="Font" tooltip="Select the font used throughout the application.">
                    <Select
                      value={config.appearance.font_family || 'System'}
                      onChange={(e) => {
                        const font = (e.target as HTMLSelectElement).value;
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, font_family: font },
                        });
                      }}
                      className="w-56"
                    >
                      <option value="Inter">Inter</option>
                      <option value="IBM Plex Sans">IBM Plex Sans</option>
                      <option value="JetBrains Mono">JetBrainsMonoNL NF SemiBold</option>
                      <option value="Iosevka">Iosevka</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Geist">Geist</option>
                      <option value="System">System</option>
                    </Select>
                  </SettingRow>

                  <SettingRow label="UI Scale" tooltip="Adjust the size of UI elements and text.">
                    <Select
                      value={config.appearance.ui_scale || 'system'}
                      onChange={(e) => {
                        const val = (e.target as HTMLSelectElement).value;
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, ui_scale: val },
                        });
                      }}
                      className="w-44"
                    >
                      <option value="system">System (100%)</option>
                      <option value="90%">90%</option>
                      <option value="100%">100%</option>
                      <option value="110%">110%</option>
                      <option value="125%">125%</option>
                      <option value="150%">150%</option>
                      <option value="175%">175%</option>
                      <option value="200%">200%</option>
                    </Select>
                  </SettingRow>
                </SettingsGroup>

                <SettingsGroup>
                  <SettingRow label="Compact Top Bar" subtext={config.appearance.compact_top_bar !== false ? 'Enabled' : 'Disabled'} tooltip="Reduce the height of the top toolbar for a more minimal look.">
                    <SwitchToggle
                      checked={config.appearance.compact_top_bar !== false}
                      onChange={(val) =>
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, compact_top_bar: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Show Icon Labels" subtext={config.appearance.show_icon_labels !== false ? 'Enabled' : 'Disabled'} tooltip="Show or hide text labels next to toolbar icons.">
                    <SwitchToggle
                      checked={config.appearance.show_icon_labels !== false}
                      onChange={(val) =>
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, show_icon_labels: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Use relative date/time" subtext={config.appearance.use_relative_date_time !== false ? 'Enabled' : 'Disabled'} tooltip="Display dates and times relative to now (e.g., '2 hours ago') instead of absolute.">
                    <SwitchToggle
                      checked={config.appearance.use_relative_date_time !== false}
                      onChange={(val) =>
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, use_relative_date_time: val },
                        })
                      }
                    />
                  </SettingRow>
                </SettingsGroup>

                <SettingsGroup>
                  <SettingRow label="Start On Boot" subtext={config.appearance.start_on_boot !== false ? 'Enabled' : 'Disabled'} tooltip="Launch Rilo automatically when your computer starts.">
                    <SwitchToggle
                      checked={config.appearance.start_on_boot !== false}
                      onChange={(val) =>
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, start_on_boot: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Use System Tray" subtext={config.appearance.use_system_tray !== false ? 'Enabled' : 'Disabled'} tooltip="Keep Rilo running in the system tray when the window is closed.">
                    <SwitchToggle
                      checked={config.appearance.use_system_tray !== false}
                      onChange={(val) =>
                        updateLocalConfig({
                          ...config,
                          appearance: { ...config.appearance, use_system_tray: val },
                        })
                      }
                    />
                  </SettingRow>
                </SettingsGroup>
              </div>
            )}

            {/* TAB 2: DOWNLOAD ENGINE */}
            {activeTab === 'downloads' && (
              <div className="space-y-4">
                <SettingsGroup>
                  <SettingRow label="Default Download Folder" tooltip="The folder where downloads will be saved by default.">
                    <div className="flex items-center space-x-2">
                      <Input
                        value={config.download.download_directory}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            download: {
                              ...config.download,
                              download_directory: (e.target as HTMLInputElement).value,
                            },
                          })
                        }
                        placeholder="Select default download folder..."
                        className="w-72 font-mono text-xs"
                      />
                      <Button variant="secondary" size="sm" onClick={handlePickFolder} className="space-x-1 shrink-0">
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Browse</span>
                      </Button>
                    </div>
                  </SettingRow>

                  <div className="py-1">
                    <SettingRow
                      label="Use Category By Default"
                      subtext={config.download.use_category_by_default ? 'Enabled' : 'Disabled'}
                      tooltip="Automatically organize downloads into subfolders based on file type (Compressed, Programs, Videos, etc.) when enabled."
                    >
                      <SwitchToggle
                        checked={!!config.download.use_category_by_default}
                        onChange={(val) =>
                          setConfig({
                            ...config,
                            download: { ...config.download, use_category_by_default: val },
                          })
                        }
                      />
                    </SettingRow>
                    <p className="text-[11px] text-rilo-muted mt-0.5 mb-2 leading-normal break-words">
                      Automatically organize categorized downloads inside a dedicated <span className="font-semibold text-rilo-accent">Rilo</span> folder into <span className="font-medium text-rilo-primary">Compressed</span>, <span className="font-medium text-rilo-primary">Programs</span>, <span className="font-medium text-rilo-primary">Videos</span>, <span className="font-medium text-rilo-primary">Music</span>, <span className="font-medium text-rilo-primary">Pictures</span>, <span className="font-medium text-rilo-primary">Documents</span>, and <span className="font-medium text-rilo-primary">Other</span> subfolders.
                    </p>
                    {config.download.use_category_by_default && (
                      <div className="mt-2 p-3 bg-rilo-surface/80 border border-rilo-subtle rounded-lg text-[11px] font-mono text-rilo-muted leading-relaxed select-text overflow-hidden">
                        <div className="font-semibold text-rilo-accent text-xs mb-1">Download folder structure:</div>
                        <div className="truncate">{config.download.download_directory || 'Downloads'}/</div>
                        <div className="pl-3 text-rilo-primary font-semibold">└── 📁 Rilo/</div>
                        <div className="pl-6 text-rilo-secondary">├── 📁 Compressed/</div>
                        <div className="pl-6 text-rilo-secondary">├── 📁 Documents/</div>
                        <div className="pl-6 text-rilo-secondary">├── 📁 Music/</div>
                        <div className="pl-6 text-rilo-secondary">├── 📁 Pictures/</div>
                        <div className="pl-6 text-rilo-secondary">├── 📁 Programs/</div>
                        <div className="pl-6 text-rilo-secondary">├── 📁 Videos/</div>
                        <div className="pl-6 text-rilo-secondary">└── 📁 Other/</div>
                      </div>
                    )}
                  </div>
                </SettingsGroup>

                <SettingsGroup>
                  <SettingRow label="Global Speed Limiter" tooltip="Limit the overall download speed across all active downloads. Enter 0 for unlimited.">
                    <div className="flex items-center space-x-1.5 justify-end w-36">
                      <Input
                        type="number"
                        value={config.download.global_speed_limit_kbps}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            download: {
                              ...config.download,
                              global_speed_limit_kbps: Math.max(0, parseInt((e.target as HTMLInputElement).value, 10) || 0),
                            },
                          })
                        }
                        className="w-24 font-mono text-xs text-right"
                      />
                      <span className="text-xs text-rilo-muted font-mono">KB/s</span>
                    </div>
                  </SettingRow>

                  <SettingRow label="Thread Count" subtext={`A download can have up to ${config.download.max_connections_per_download} threads`} tooltip="Maximum number of concurrent connections (segments) per download.">
                    <Select
                      value={config.download.max_connections_per_download.toString()}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          download: {
                            ...config.download,
                            max_connections_per_download: parseInt((e.target as HTMLSelectElement).value, 10) || 8,
                          },
                        })
                      }
                      className="w-36 font-mono"
                    >
                      {[1, 2, 4, 8, 16, 32].map((n) => (
                        <option key={n} value={n.toString()}>
                          {n} {n === 1 ? 'thread' : 'threads'}
                        </option>
                      ))}
                    </Select>
                  </SettingRow>

                  <SettingRow label="Maximum Concurrent Downloads" tooltip="How many downloads can run simultaneously.">
                    <Select
                      value={config.download.max_concurrent_downloads.toString()}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          download: {
                            ...config.download,
                            max_concurrent_downloads: parseInt((e.target as HTMLSelectElement).value, 10) || 4,
                          },
                        })
                      }
                      className="w-36 font-mono"
                    >
                      {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
                        <option key={n} value={n.toString()}>
                          {n} active
                        </option>
                      ))}
                    </Select>
                  </SettingRow>

                  <SettingRow label="Maximum Download Retries" subtext={`Failed downloads will be retried ${config.download.retry_count} time(s)`} tooltip="Number of times to retry a failed download before giving up.">
                    <Select
                      value={config.download.retry_count.toString()}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          download: {
                            ...config.download,
                            retry_count: parseInt((e.target as HTMLSelectElement).value, 10) || 3,
                          },
                        })
                      }
                      className="w-36 font-mono"
                    >
                      {[0, 1, 2, 3, 5, 10].map((n) => (
                        <option key={n} value={n.toString()}>
                          {n} {n === 1 ? 'retry' : 'retries'}
                        </option>
                      ))}
                    </Select>
                  </SettingRow>

                  <SettingRow label="Connection Timeout" subtext="HTTP connect timeout in seconds" tooltip="Seconds to wait before timing out a connection attempt.">
                    <Select
                      value={(config.download.connection_timeout_seconds || 30).toString()}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          download: {
                            ...config.download,
                            connection_timeout_seconds: parseInt((e.target as HTMLSelectElement).value, 10) || 30,
                          },
                        })
                      }
                      className="w-36 font-mono"
                    >
                      {[10, 15, 30, 60, 120, 300].map((s) => (
                        <option key={s} value={s.toString()}>
                          {s} sec
                        </option>
                      ))}
                    </Select>
                  </SettingRow>

                  <SettingRow label="Pre-Check Disk Free Space" subtext={config.download.check_disk_space !== false ? 'Enabled' : 'Disabled'} tooltip="Check available disk space before starting a download to prevent incomplete writes.">
                    <SwitchToggle
                      checked={config.download.check_disk_space !== false}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          download: { ...config.download, check_disk_space: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Append '.part' Extension To Incomplete Downloads" subtext={config.download.append_extension_incomplete ? 'Enabled' : 'Disabled'} tooltip="Add .part to incomplete download filenames to distinguish them from finished files.">
                    <SwitchToggle
                      checked={!!config.download.append_extension_incomplete}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          download: { ...config.download, append_extension_incomplete: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Ignore SSL Certificate Errors" subtext={config.download.ignore_ssl_certificates ? 'Enabled' : 'Disabled'} tooltip="Bypass SSL certificate validation (use only if you trust the source).">
                    <SwitchToggle
                      checked={!!config.download.ignore_ssl_certificates}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          download: { ...config.download, ignore_ssl_certificates: val },
                        })
                      }
                    />
                  </SettingRow>
                </SettingsGroup>

                <SettingsGroup>
                  <SettingRow
                    label="Auto Extract Archives By Default"
                    subtext={config.download.auto_extract_archives ? 'Enabled' : 'Disabled'}
                    tooltip="Automatically extract ZIP and archive files after download completion."
                  >
                    <SwitchToggle
                      checked={!!config.download.auto_extract_archives}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          download: { ...config.download, auto_extract_archives: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow
                    label="Delete Archive After Extraction By Default"
                    subtext={config.download.delete_archive_after_extraction ? 'Enabled' : 'Disabled'}
                    tooltip="Delete the original downloaded archive file after extracting its contents successfully."
                  >
                    <SwitchToggle
                      checked={!!config.download.delete_archive_after_extraction}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          download: { ...config.download, delete_archive_after_extraction: val },
                        })
                      }
                    />
                  </SettingRow>
                </SettingsGroup>
              </div>
            )}

            {/* TAB 3: PROXY & NETWORK */}
            {activeTab === 'proxy' && (
              <div>
                <SettingsGroup>
                  <SettingRow label="Proxy Mode" tooltip="Choose how the proxy is configured: System (use OS proxy), Manual, or None.">
                    <Select
                      value={config.download.proxy.mode || 'system'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          download: {
                            ...config.download,
                            proxy: { ...config.download.proxy, mode: (e.target as HTMLSelectElement).value },
                          },
                        })
                      }
                      className="w-44"
                    >
                      <option value="system">Use System Proxy</option>
                      <option value="manual">Manual Proxy Configuration</option>
                      <option value="none">No Proxy (Direct Connection)</option>
                    </Select>
                  </SettingRow>

                  {config.download.proxy.mode === 'manual' && (
                    <>
                      <SettingRow label="HTTP Proxy URL" subtext="e.g. http://127.0.0.1:8080" tooltip="The address of the proxy server (e.g., http://proxy.example.com:8080).">
                        <Input
                          value={config.download.proxy.http_proxy || ''}
                          placeholder="http://127.0.0.1:8080"
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              download: {
                                ...config.download,
                                proxy: { ...config.download.proxy, http_proxy: (e.target as HTMLInputElement).value },
                              },
                            })
                          }
                          className="w-72 font-mono text-xs"
                        />
                      </SettingRow>

                      <SettingRow label="Proxy Username" subtext="Optional Basic Auth user" tooltip="Username for proxy authentication (if required).">
                        <Input
                          value={config.download.proxy.username || ''}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              download: {
                                ...config.download,
                                proxy: { ...config.download.proxy, username: (e.target as HTMLInputElement).value },
                              },
                            })
                          }
                          className="w-48 font-mono text-xs"
                        />
                      </SettingRow>

                      <SettingRow label="Proxy Password" subtext="Optional Basic Auth password" tooltip="Password for proxy authentication.">
                        <Input
                          type="password"
                          value={config.download.proxy.password || ''}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              download: {
                                ...config.download,
                                proxy: { ...config.download.proxy, password: (e.target as HTMLInputElement).value },
                              },
                            })
                          }
                          className="w-48 font-mono text-xs"
                        />
                      </SettingRow>

                      <SettingRow label="Test Proxy Connection" tooltip="Check if the proxy configuration is working.">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleTestProxy}
                          disabled={testingProxy || !config.download.proxy.http_proxy}
                        >
                          {testingProxy ? 'Testing...' : 'Test Connection'}
                        </Button>
                      </SettingRow>

                      {proxyTestStatus && (
                        <div className="py-2 text-xs font-semibold text-rilo-accent">
                          {proxyTestStatus}
                        </div>
                      )}
                    </>
                  )}
                </SettingsGroup>
              </div>
            )}

            {/* TAB 4: SAVED LOGINS (SITE CREDENTIALS) */}
            {activeTab === 'credentials' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-rilo-primary">Saved Site Credentials</h3>
                    <p className="text-[11px] text-rilo-muted">Automatically authenticate on password-protected subscription domains.</p>
                  </div>
                  <Button variant="default" size="sm" onClick={() => setShowAddCredModal(true)} className="space-x-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Credential</span>
                  </Button>
                </div>

                {showAddCredModal && (
                  <div className="bg-rilo-elevated border border-rilo-accent/60 rounded-xl p-4 space-y-3 mb-4 animate-in fade-in duration-100">
                    <h4 className="text-xs font-bold text-rilo-primary">Add Site Credential</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        placeholder="Domain (e.g. example.com)"
                        value={credDomain}
                        onChange={(e) => setCredDomain((e.target as HTMLInputElement).value)}
                        className="text-xs"
                      />
                      <Input
                        placeholder="Username"
                        value={credUser}
                        onChange={(e) => setCredUser((e.target as HTMLInputElement).value)}
                        className="text-xs"
                      />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={credPass}
                        onChange={(e) => setCredPass((e.target as HTMLInputElement).value)}
                        className="text-xs"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowAddCredModal(false)}>
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" onClick={handleSaveCred} disabled={!credDomain || !credUser || !credPass}>
                        Save Login
                      </Button>
                    </div>
                  </div>
                )}

                <SettingsGroup>
                  {credentials.length === 0 ? (
                    <div className="py-6 text-center text-xs text-rilo-muted">
                      No saved site credentials yet. Click "Add Credential" to save domain logins.
                    </div>
                  ) : (
                    credentials.map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-xs font-bold text-rilo-primary">{c.domain}</div>
                          <div className="text-[11px] text-rilo-muted font-mono">User: {c.username}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCred(c.id)} className="text-rose-400 hover:text-rose-300">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </SettingsGroup>
              </div>
            )}

            {/* TAB 5: SCHEDULER & QUEUES */}
            {activeTab === 'scheduler' && (
              <div>
                <SettingsGroup>
                  <SettingRow label="Enable Schedule" subtext={config.scheduler.schedule_enabled ? 'Active' : 'Disabled'} tooltip="Turn on scheduled download time windows.">
                    <SwitchToggle
                      checked={config.scheduler.schedule_enabled}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          scheduler: { ...config.scheduler, schedule_enabled: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Start Time (HH:MM)" subtext="Format 24h (e.g. 22:00)" tooltip="When the download window begins (24‑hour format).">
                    <Input
                      value={config.scheduler.start_time}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          scheduler: { ...config.scheduler, start_time: (e.target as HTMLInputElement).value },
                        })
                      }
                      className="w-28 font-mono text-xs"
                    />
                  </SettingRow>

                  <SettingRow label="Stop Time (HH:MM)" subtext="Format 24h (e.g. 06:00)" tooltip="When the download window ends (24‑hour format).">
                    <Input
                      value={config.scheduler.stop_time}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          scheduler: { ...config.scheduler, stop_time: (e.target as HTMLInputElement).value },
                        })
                      }
                      className="w-28 font-mono text-xs"
                    />
                  </SettingRow>

                  <SettingRow label="Active Scheduled Days" tooltip="Select which days of the week the schedule applies.">
                    <div className="flex items-center space-x-1.5">
                      {daysList.map((day) => {
                        const active = (config.scheduler.active_days || []).includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => {
                              const currentDays = config.scheduler.active_days || [];
                              const newDays = active
                                ? currentDays.filter((d) => d !== day.id)
                                : [...currentDays, day.id];
                              setConfig({
                                ...config,
                                scheduler: { ...config.scheduler, active_days: newDays },
                              });
                            }}
                            className={`px-2 py-1 text-[10px] font-bold rounded border cursor-pointer transition-colors ${
                              active
                                ? 'bg-rilo-accent text-white border-rilo-accent'
                                : 'bg-rilo-surface text-rilo-muted border-rilo-subtle hover:text-rilo-primary'
                            }`}
                          >
                            {day.name}
                          </button>
                        );
                      })}
                    </div>
                  </SettingRow>

                  <SettingRow label="Post-Download Action" tooltip="What to do after all downloads finish: Nothing, Notify, Sleep, Shutdown, Hibernate, or Run a Custom Command.">
                    <Select
                      value={config.scheduler.post_download_action || 'none'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          scheduler: { ...config.scheduler, post_download_action: (e.target as HTMLSelectElement).value },
                        })
                      }
                      className="w-48"
                    >
                      <option value="none">None (Keep App Open)</option>
                      <option value="notify">Notify Only</option>
                      <option value="sleep">System Sleep</option>
                      <option value="shutdown">System Shutdown</option>
                      <option value="hibernate">System Hibernate</option>
                      <option value="command">Run Custom Command</option>
                    </Select>
                  </SettingRow>

                  {config.scheduler.post_download_action === 'command' && (
                    <SettingRow label="Custom Executable Command" subtext="e.g. C:\scripts\notify.bat" tooltip="Path to a script or executable to run after all downloads complete.">
                      <Input
                        value={config.scheduler.custom_command || ''}
                        placeholder="C:\path\to\script.exe"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            scheduler: { ...config.scheduler, custom_command: (e.target as HTMLInputElement).value },
                          })
                        }
                        className="w-72 font-mono text-xs"
                      />
                    </SettingRow>
                  )}
                </SettingsGroup>
              </div>
            )}

            {/* TAB 6: BROWSER INTEGRATION */}
            {activeTab === 'browser' && (
              <div>
                <SettingsGroup>
                  <SettingRow label="Browser Integration" subtext={config.browser?.enabled !== false ? 'Enabled' : 'Disabled'} tooltip="Start the local IPC server to accept links from the browser extension.">
                    <SwitchToggle
                      checked={config.browser?.enabled !== false}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          browser: { ...config.browser, enabled: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="Server Port" subtext={`App will listen to port ${config.browser?.port || 15151}`} tooltip="The port used for communication with the browser extension (15151–15153).">
                    <Select
                      value={(config.browser?.port || 15151).toString()}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          browser: {
                            ...config.browser,
                            port: parseInt((e.target as HTMLSelectElement).value, 10) || 15151,
                          },
                        })
                      }
                      className="w-32 font-mono"
                    >
                      <option value="15151">15151</option>
                      <option value="15152">15152</option>
                      <option value="15153">15153</option>
                    </Select>
                  </SettingRow>

                  <SettingRow label="Use API Key" subtext={config.browser?.use_api_key ? 'Enabled' : 'Disabled'} tooltip="Enable or disable API key authentication for the extension.">
                    <SwitchToggle
                      checked={!!config.browser?.use_api_key}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          browser: { ...config.browser, use_api_key: val },
                        })
                      }
                    />
                  </SettingRow>

                  <SettingRow label="API Key" subtext={config.browser?.use_api_key ? 'Enabled' : 'Disabled'} tooltip="The secret key that the browser extension must provide to connect.">
                    <Input
                      value={config.browser?.api_key || 'VNrFjwyVENqcnGnBCVtiYjw1'}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          browser: {
                            ...config.browser,
                            api_key: (e.target as HTMLInputElement).value,
                          },
                        })
                      }
                      className="w-72 font-mono text-xs"
                    />
                  </SettingRow>
                </SettingsGroup>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-rilo-subtle bg-rilo-surface flex items-center justify-between flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={handleResetDefaults} className="space-x-1.5 text-rilo-muted">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Defaults</span>
          </Button>
          <div className="flex items-center space-x-2">
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
