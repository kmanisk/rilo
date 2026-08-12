export interface AppearanceSettings {
  theme: string;
  mode?: string;
  default_dark_theme?: string;
  default_light_theme?: string;
  language?: string;
  ui_scale?: string;
  compact_top_bar?: boolean;
  show_icon_labels?: boolean;
  use_relative_date_time?: boolean;
  start_on_boot?: boolean;
  use_system_tray?: boolean;
  download_size_unit?: string;
  download_speed_unit?: string;
  show_average_speed?: boolean;
  notification_sound?: boolean;
  show_download_progress_dialog?: boolean;
  show_download_completion_dialog?: boolean;
  render_api?: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  font_size_px: number;
  density: string;
}

import { getRiloTheme } from "../themes/themes";

export function getSystemAppearance(): "dark" | "light" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

export function resolveEffectiveMode(modeSetting?: string): "dark" | "light" {
  const norm = (modeSetting || "system").toLowerCase();
  if (norm === "light") return "light";
  if (norm === "dark") return "dark";
  return getSystemAppearance();
}

export function applyVisualSettings(config: AppearanceSettings) {
  const root = document.documentElement;
  const effectiveMode = resolveEffectiveMode(config.mode);
  const palette = getRiloTheme(config.theme || "rilo-default", effectiveMode);
  const accent = (config.accent_color || "indigo").toLowerCase();
  const font = config.font_family || "System";
  const density = (config.density || "comfortable").toLowerCase();
  const fontSizePx = config.font_size_px || 15;

  root.setAttribute("data-theme", effectiveMode);
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-theme-preset", palette.id);
  root.setAttribute("data-appearance-mode", config.mode || "system");

  Object.entries(palette.colors).forEach(([name, value]) =>
    root.style.setProperty(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value)
  );

  root.style.setProperty("--surface-selected", palette.colors.surfaceActive);
  root.style.setProperty("--surface-hover", palette.colors.surfaceHover || palette.colors.surface);
  root.style.setProperty("--text-primary", palette.colors.textPrimary);
  root.style.setProperty("--text-secondary", palette.colors.textSecondary);
  root.style.setProperty("--text-muted", palette.colors.textMuted);
  root.style.setProperty("--border-subtle", palette.colors.border);
  root.style.setProperty(
    "--overlay",
    effectiveMode === "light" ? "rgba(15, 23, 42, .42)" : "rgba(0, 0, 0, .62)"
  );

  const customAccents: Record<string, string> = {
    indigo: "",
    blue: "#3b82f6",
    purple: "#a855f7",
    emerald: "#10b981",
    green: "#10b981",
    orange: "#f97316",
    rose: "#f43f5e",
    red: "#f43f5e",
  };

  const activeAccent = customAccents[accent] || palette.colors.accent;
  root.style.setProperty("--accent", activeAccent);
  root.style.setProperty("--rilo-accent", activeAccent);
  root.style.setProperty("--rilo-accent-hover", palette.colors.accentHover || activeAccent);
  root.style.setProperty("--rilo-accent-active", palette.colors.accentHover || activeAccent);
  root.style.setProperty("--rilo-accent-foreground", palette.colors.accentForeground);
  root.style.setProperty("--rilo-accent-muted", palette.colors.selection);
  root.style.setProperty("--rilo-accent-border", palette.colors.borderStrong);
  root.setAttribute("data-font", font);
  root.setAttribute("data-density", density);
  root.classList.toggle("dark", effectiveMode === "dark");
  root.classList.toggle("light", effectiveMode === "light");
  root.style.setProperty("--rilo-font-size", `${fontSizePx}px`);
}
