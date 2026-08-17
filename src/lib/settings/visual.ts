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
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

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

export function parseScaleFactor(scaleSetting?: string): number {
  const raw = (scaleSetting || "system").toLowerCase().trim();
  if (raw === "90%") return 0.9;
  if (raw === "100%") return 1.0;
  if (raw === "110%") return 1.1;
  if (raw === "125%") return 1.25;
  if (raw === "150%") return 1.5;
  if (raw === "175%") return 1.75;
  if (raw === "200%") return 2.0;
  return 1.0;
}

let lastAppliedScaleSetting: string | null = null;

export async function applyUiScaleWindow(scaleSetting?: string) {
  try {
    const normScale = scaleSetting || "system";
    if (lastAppliedScaleSetting === normScale) {
      return;
    }
    lastAppliedScaleSetting = normScale;

    const factor = parseScaleFactor(scaleSetting);
    const win = getCurrentWindow();
    const isMax = await win.isMaximized();
    if (!isMax) {
      const baseW = 1080;
      const baseH = 700;
      const targetW = Math.round(baseW * factor);
      const targetH = Math.round(baseH * factor);
      await win.setSize(new LogicalSize(targetW, targetH));
    }
  } catch (err) {
    // Non-Tauri environment or window resize not supported
  }
}

export function applyVisualSettings(config: AppearanceSettings) {
  const root = document.documentElement;
  const effectiveMode = resolveEffectiveMode(config.mode);
  const palette = getRiloTheme(config.theme || "rilo-default", effectiveMode);
  const isLight = palette.isLight;
  const modeStr = isLight ? "light" : "dark";
  const accent = (config.accent_color || "indigo").toLowerCase();
  const font = config.font_family || "System";
  const density = (config.density || "comfortable").toLowerCase();
  const fontSizePx = config.font_size_px || 15;
  const scaleFactor = parseScaleFactor(config.ui_scale);

  // Clear any legacy CSS zoom to prevent viewport clipping
  (root.style as any).zoom = "";

  root.setAttribute("data-theme", modeStr);
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-theme-preset", palette.id);
  root.setAttribute("data-appearance-mode", config.mode || "system");
  root.setAttribute("data-font", font);
  root.setAttribute("data-density", density);
  root.setAttribute("data-scale", config.ui_scale || "system");

  root.classList.toggle("dark", !isLight);
  root.classList.toggle("light", isLight);

  // Set all core CSS variable tokens on root style
  root.style.setProperty("--background", palette.colors.background);
  root.style.setProperty("--surface", palette.colors.surface);
  root.style.setProperty("--surface-elevated", palette.colors.elevated || palette.colors.surface);
  root.style.setProperty("--surface-hover", palette.colors.surfaceHover || palette.colors.elevated || palette.colors.surface);
  root.style.setProperty("--surface-selected", palette.colors.surfaceActive || palette.colors.elevated);
  root.style.setProperty("--text-primary", palette.colors.textPrimary);
  root.style.setProperty("--text-secondary", palette.colors.textSecondary);
  root.style.setProperty("--text-muted", palette.colors.textMuted);
  root.style.setProperty("--border", palette.colors.border);
  root.style.setProperty("--border-subtle", palette.colors.border);
  root.style.setProperty("--border-strong", palette.colors.borderStrong || palette.colors.border);
  root.style.setProperty(
    "--overlay",
    isLight ? "rgba(15, 23, 42, .42)" : "rgba(0, 0, 0, .62)"
  );

  // Set any custom camelCase properties as kebab-case
  Object.entries(palette.colors).forEach(([name, value]) =>
    root.style.setProperty(`--${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, value)
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

  const activeAccent = customAccents[accent] || palette.colors.accent || "#6366f1";
  root.style.setProperty("--accent", activeAccent);
  root.style.setProperty("--rilo-accent", activeAccent);
  root.style.setProperty("--rilo-accent-hover", palette.colors.accentHover || activeAccent);
  root.style.setProperty("--rilo-accent-active", palette.colors.accentHover || activeAccent);
  const fontFamilies: Record<string, string> = {
    "Inter": '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    "Geist": '"Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    "IBM Plex Sans": '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    "JetBrains Mono": '"JetBrains Mono", "Cascadia Code", "Consolas", "Courier New", monospace',
    "Iosevka": '"Iosevka Web", "Iosevka", "Iosevka Fixed", "Iosevka Term", "Cascadia Mono", "Consolas", monospace',
    "Roboto": '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "System": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  };
  const activeFontFamily = fontFamilies[font] || fontFamilies["System"];
  root.style.setProperty("--font-family", activeFontFamily);
  if (typeof document !== "undefined" && document.body) {
    document.body.style.fontFamily = activeFontFamily;
  }

  const scaledFontSize = Math.round(fontSizePx * scaleFactor);
  root.style.setProperty("--rilo-font-size", `${scaledFontSize}px`);
  root.style.setProperty("--rilo-scale-factor", String(scaleFactor));
}
