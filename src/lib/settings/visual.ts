export interface AppearanceSettings {
  theme: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  font_size_px: number;
  density: string;
}

import { getRiloTheme } from "../themes/themes";

export function applyVisualSettings(config: AppearanceSettings) {
  const root = document.documentElement;
  const palette = getRiloTheme(config.theme || "rilo-default");
  const theme = /light|latte|gruvbox-light|solarized-light/.test(palette.id) ? "light" : "dark";
  const accent = (config.accent_color || "indigo").toLowerCase();
  const font = config.font_family || "System";
  const density = (config.density || "comfortable").toLowerCase();
  const fontSizePx = config.font_size_px || 15;
  root.setAttribute("data-theme", theme); root.setAttribute("data-accent", accent);
  root.setAttribute("data-theme-preset", palette.id);
  Object.entries(palette.colors).forEach(([name, value]) => root.style.setProperty(`--${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, value));
  root.style.setProperty("--surface-selected", palette.colors.surfaceActive);
  root.style.setProperty("--surface-hover", palette.colors.surfaceHover);
  root.style.setProperty("--text-primary", palette.colors.textPrimary);
  root.style.setProperty("--text-secondary", palette.colors.textSecondary);
  root.style.setProperty("--text-muted", palette.colors.textMuted);
  root.style.setProperty("--border-subtle", palette.colors.border);
  root.style.setProperty("--overlay", theme === "light" ? "rgba(15, 23, 42, .42)" : "rgba(0, 0, 0, .62)");
  const customAccents: Record<string, string> = { indigo: "", blue: "#3b82f6", purple: "#a855f7", emerald: "#10b981", green: "#10b981", orange: "#f97316", rose: "#f43f5e", red: "#f43f5e" };
  const activeAccent = customAccents[accent] || palette.colors.accent;
  root.style.setProperty("--accent", activeAccent);
  root.style.setProperty("--rilo-accent", activeAccent);
  root.style.setProperty("--rilo-accent-hover", palette.colors.accentHover || activeAccent);
  root.style.setProperty("--rilo-accent-active", palette.colors.accentHover || activeAccent);
  root.style.setProperty("--rilo-accent-foreground", palette.colors.accentForeground);
  root.style.setProperty("--rilo-accent-muted", palette.colors.selection);
  root.style.setProperty("--rilo-accent-border", palette.colors.borderStrong);
  root.setAttribute("data-font", font); root.setAttribute("data-density", density);
  root.classList.toggle("dark", theme === "dark"); root.classList.toggle("light", theme === "light");
  root.style.setProperty("--rilo-font-size", `${fontSizePx}px`);
}
