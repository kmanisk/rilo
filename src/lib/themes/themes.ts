export interface RiloTheme {
  id: string;
  name: string;
  category?: "dark" | "light";
  colors: Record<string, string>;
  lightColors?: Record<string, string>;
}

const dark = (
  background: string,
  surface: string,
  elevated: string,
  text: string,
  secondary: string,
  muted: string,
  accent: string,
  success = "#3fb950",
  warning = "#d29922",
  error = "#f85149"
): Record<string, string> => ({
  background,
  surface,
  elevated,
  surfaceHover: elevated,
  surfaceActive: "#30363d",
  border: "#30363d",
  borderStrong: "#484f58",
  textPrimary: text,
  textSecondary: secondary,
  textMuted: muted,
  accent,
  accentHover: accent,
  accentForeground: "#ffffff",
  success,
  warning,
  error,
  info: accent,
  progressTrack: elevated,
  selection: "rgba(88,166,255,.18)",
});

const light = (
  background: string,
  surface: string,
  elevated: string,
  text: string,
  secondary: string,
  muted: string,
  accent: string,
  success = "#1a7f37",
  warning = "#9a6700",
  error = "#cf222e"
): Record<string, string> => ({
  ...dark(background, surface, elevated, text, secondary, muted, accent, success, warning, error),
  surfaceHover: "#eaeea0",
  surfaceActive: "#d0d7de",
  border: "#d0d7de",
  borderStrong: "#afb8c1",
  accentForeground: "#ffffff",
  selection: "rgba(9,105,218,.14)",
});

export const riloThemes: RiloTheme[] = [
  {
    id: "rilo-default",
    name: "Rilo Default",
    category: "dark",
    colors: dark("#09090b", "#121215", "#1b1b20", "#f4f4f5", "#a1a1aa", "#71717a", "#6366f1"),
    lightColors: light("#f8fafc", "#ffffff", "#f1f5f9", "#0f172a", "#475569", "#64748b", "#6366f1"),
  },
  {
    id: "rilo-light",
    name: "Rilo Light",
    category: "light",
    colors: light("#f8fafc", "#ffffff", "#f1f5f9", "#0f172a", "#475569", "#64748b", "#6366f1"),
  },
  {
    id: "ayu-dark",
    name: "Ayu Dark",
    category: "dark",
    colors: dark("#0b0e14", "#0f1419", "#1a1f29", "#bfbdb6", "#b3b1ad", "#626a73", "#e6b450", "#aad94c", "#ffb454", "#f07178"),
    lightColors: light("#f8f9fa", "#ffffff", "#f3f4f5", "#5c6166", "#8a9199", "#abb0b6", "#ff9900"),
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    category: "dark",
    colors: dark("#1e1e2e", "#181825", "#313244", "#cdd6f4", "#bac2de", "#7f849c", "#89b4fa", "#a6e3a1", "#f9e2af", "#f38ba8"),
    lightColors: light("#eff1f5", "#ffffff", "#e6e9ef", "#4c4f69", "#5c5f77", "#8c8fa1", "#1e66f5"),
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    category: "light",
    colors: light("#eff1f5", "#ffffff", "#e6e9ef", "#4c4f69", "#5c5f77", "#8c8fa1", "#1e66f5"),
  },
  {
    id: "dracula",
    name: "Dracula",
    category: "dark",
    colors: dark("#282a36", "#343746", "#44475a", "#f8f8f2", "#d4d4d8", "#9aa0b3", "#bd93f9", "#50fa7b", "#ffb86c", "#ff5555"),
    lightColors: light("#f8f8f2", "#ffffff", "#e9e9f4", "#282a36", "#44475a", "#6272a4", "#bd93f9"),
  },
  {
    id: "everforest-dark",
    name: "Everforest Dark",
    category: "dark",
    colors: dark("#2d353b", "#343f44", "#3d484d", "#d3c6aa", "#a7c080", "#859289", "#83c092", "#a7c080", "#dbbc7f", "#e67e80"),
    lightColors: light("#fdf6e3", "#f4f0d9", "#e8e5c8", "#5c6a72", "#708089", "#939f91", "#8da101"),
  },
  {
    id: "github-dark",
    name: "GitHub Dark",
    category: "dark",
    colors: dark("#0d1117", "#161b22", "#21262d", "#e6edf3", "#8b949e", "#6e7681", "#58a6ff"),
    lightColors: light("#f6f8fa", "#ffffff", "#f3f4f6", "#1f2328", "#59636e", "#6e7781", "#0969da"),
  },
  {
    id: "github-light",
    name: "GitHub Light",
    category: "light",
    colors: light("#f6f8fa", "#ffffff", "#f3f4f6", "#1f2328", "#59636e", "#6e7781", "#0969da"),
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    category: "dark",
    colors: dark("#282828", "#3c3836", "#504945", "#ebdbb2", "#d5c4a1", "#a89984", "#fabd2f", "#b8bb26", "#fabd2f", "#fb4934"),
    lightColors: light("#fbf1c7", "#f9f5d7", "#ebdbb2", "#3c3836", "#665c54", "#928374", "#076678"),
  },
  {
    id: "gruvbox-light",
    name: "Gruvbox Light",
    category: "light",
    colors: light("#fbf1c7", "#f9f5d7", "#ebdbb2", "#3c3836", "#665c54", "#928374", "#076678"),
  },
  {
    id: "jetbrains",
    name: "JetBrains",
    category: "dark",
    colors: dark("#1e1f22", "#2b2d30", "#393b40", "#dfe1e5", "#9da0a8", "#6f737a", "#3574f0", "#57965c", "#e5b567", "#e55656"),
    lightColors: light("#f7f8fa", "#ffffff", "#ebeef2", "#27282c", "#5a5d6b", "#818594", "#3574f0"),
  },
  {
    id: "luna-xp",
    name: "Luna XP",
    category: "dark",
    colors: dark("#0c1524", "#132036", "#1b2b48", "#e2ebf8", "#a0b4d4", "#6784b2", "#2563eb", "#22c55e", "#eab308", "#ef4444"),
    lightColors: light("#e6effe", "#f0f4fc", "#ffffff", "#0f172a", "#334155", "#64748b", "#2563eb"),
  },
  {
    id: "monokai",
    name: "Monokai",
    category: "dark",
    colors: dark("#272822", "#1e1f1c", "#3e3d32", "#f8f8f2", "#cfcfc2", "#8f908a", "#66d9ef", "#a6e22e", "#e6db74", "#f92672"),
    lightColors: light("#f8f8f2", "#ffffff", "#efefed", "#272822", "#595959", "#8f908a", "#008080"),
  },
  {
    id: "nord",
    name: "Nord",
    category: "dark",
    colors: dark("#2e3440", "#3b4252", "#434c5e", "#eceff4", "#d8dee9", "#81a1c1", "#88c0d0", "#a3be8c", "#ebcb8b", "#bf616a"),
    lightColors: light("#eceff4", "#e5e9f0", "#d8dee9", "#2e3440", "#4c566a", "#7b88a1", "#5e81ac"),
  },
  {
    id: "one-dark",
    name: "One Dark",
    category: "dark",
    colors: dark("#282c34", "#21252b", "#353b45", "#abb2bf", "#9da5b4", "#5c6370", "#61afef", "#98c379", "#e5c07b", "#e06c75"),
    lightColors: light("#fafafa", "#ffffff", "#f0f0f0", "#383a42", "#696c77", "#a0a1a7", "#4078f2"),
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    category: "dark",
    colors: dark("#191724", "#1f1d2e", "#26233a", "#e0def4", "#908caa", "#6e6a86", "#c4a7e7", "#9ccfd8", "#f6c177", "#eb6f92"),
    lightColors: light("#faf4ed", "#fffaf3", "#f2e9e1", "#575279", "#797593", "#9893a5", "#907aa9"),
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    category: "dark",
    colors: dark("#002b36", "#073642", "#0b4654", "#eee8d5", "#93a1a1", "#657b83", "#268bd2", "#859900", "#b58900", "#dc322f"),
    lightColors: light("#fdf6e3", "#eee8d5", "#e5ddc7", "#073642", "#586e75", "#839496", "#268bd2"),
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    category: "light",
    colors: light("#fdf6e3", "#eee8d5", "#e5ddc7", "#073642", "#586e75", "#839496", "#268bd2"),
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    category: "dark",
    colors: dark("#1a1b26", "#24283b", "#292e42", "#c0caf5", "#a9b1d6", "#565f89", "#7aa2f7", "#9ece6a", "#e0af68", "#f7768e"),
    lightColors: light("#e1e2e7", "#f3f4f7", "#ffffff", "#373e4d", "#565f89", "#7a88cf", "#7aa2f7"),
  },
];

export const getDarkThemes = () => {
  const seen = new Set<string>();
  const list = riloThemes.filter((t) => {
    if ((t.category || "dark") !== "dark") return false;
    const key = t.id.toLowerCase();
    if (seen.has(key) || seen.has(t.name.toLowerCase())) return false;
    seen.add(key);
    seen.add(t.name.toLowerCase());
    return true;
  });
  return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
};

export const getLightThemes = () => {
  const seen = new Set<string>();
  const list = riloThemes.filter((t) => {
    if (t.category !== "light") return false;
    const key = t.id.toLowerCase();
    if (seen.has(key) || seen.has(t.name.toLowerCase())) return false;
    seen.add(key);
    seen.add(t.name.toLowerCase());
    return true;
  });
  return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
};

export const getRiloTheme = (id: string, mode: "dark" | "light" = "dark") => {
  let targetId = id;
  if (id === "dark") targetId = "rilo-default";
  if (id === "light") targetId = "rilo-light";
  if (id === "catppuccin-mocha" || id === "catppuccin-macchiato") targetId = "catppuccin";
  if (id === "ayu-mirage") targetId = "ayu-dark";
  if (id === "tokyo-night-storm") targetId = "tokyo-night";

  const theme = riloThemes.find((t) => t.id === targetId) || riloThemes[0];
  const isLightTheme = theme.category === "light";

  if (isLightTheme || mode === "light") {
    const colors = theme.lightColors || theme.colors;
    return { id: theme.id, name: theme.name, colors, isLight: true };
  }

  return { id: theme.id, name: theme.name, colors: theme.colors, isLight: false };
};
