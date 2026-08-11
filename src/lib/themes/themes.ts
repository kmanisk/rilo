export interface RiloTheme { id: string; name: string; colors: Record<string, string>; }
const dark = (background:string, surface:string, elevated:string, text:string, secondary:string, muted:string, accent:string, success="#3fb950", warning="#d29922", error="#f85149"): Record<string,string> => ({background,surface,elevated,surfaceHover:elevated,surfaceActive:"#30363d",border:"#30363d",borderStrong:"#484f58",textPrimary:text,textSecondary:secondary,textMuted:muted,accent,accentHover:accent,accentForeground:"#ffffff",success,warning,error,info:accent,progressTrack:elevated,selection:"rgba(88,166,255,.18)"});
const light = (background:string, surface:string, elevated:string, text:string, secondary:string, muted:string, accent:string): Record<string,string> => ({...dark(background,surface,elevated,text,secondary,muted,accent,"#1a7f37","#9a6700","#cf222e"),surfaceActive:"#d0d7de",border:"#d0d7de",borderStrong:"#afb8c1",accentForeground:"#ffffff",selection:"rgba(9,105,218,.14)"});
export const riloThemes: RiloTheme[] = [
 {id:"luna-xp",name:"Luna XP",colors:dark("#0c1524","#132036","#1b2b48","#e2ebf8","#a0b4d4","#6784b2","#2563eb","#22c55e","#eab308","#ef4444")},
 {id:"rilo-default",name:"Rilo Default",colors:dark("#09090b","#121215","#1b1b20","#f4f4f5","#a1a1aa","#71717a","#6366f1")},
 {id:"github-dark",name:"GitHub Dark",colors:dark("#0d1117","#161b22","#21262d","#e6edf3","#8b949e","#6e7681","#58a6ff")},
 {id:"github-light",name:"GitHub Light",colors:light("#f6f8fa","#ffffff","#f3f4f6","#1f2328","#59636e","#6e7781","#0969da")},
 {id:"dracula",name:"Dracula",colors:dark("#282a36","#343746","#44475a","#f8f8f2","#d4d4d8","#9aa0b3","#bd93f9","#50fa7b","#ffb86c","#ff5555")},
 {id:"tokyo-night",name:"Tokyo Night",colors:dark("#1a1b26","#24283b","#292e42","#c0caf5","#a9b1d6","#565f89","#7aa2f7","#9ece6a","#e0af68","#f7768e")},
 {id:"tokyo-night-storm",name:"Tokyo Night Storm",colors:dark("#1f2335","#24283b","#2f354f","#c0caf5","#a9b1d6","#737aa2","#7aa2f7","#9ece6a","#e0af68","#f7768e")},
 {id:"gruvbox-dark",name:"Gruvbox Dark",colors:dark("#282828","#3c3836","#504945","#ebdbb2","#d5c4a1","#a89984","#83a598","#b8bb26","#fabd2f","#fb4934")},
 {id:"gruvbox-light",name:"Gruvbox Light",colors:light("#fbf1c7","#f9f5d7","#ebdbb2","#3c3836","#665c54","#928374","#076678")},
 {id:"catppuccin-mocha",name:"Catppuccin Mocha",colors:dark("#1e1e2e","#181825","#313244","#cdd6f4","#bac2de","#7f849c","#89b4fa","#a6e3a1","#f9e2af","#f38ba8")},
 {id:"catppuccin-macchiato",name:"Catppuccin Macchiato",colors:dark("#24273a","#1e2030","#363a4f","#cad3f5","#b8c0e0","#8087a2","#8aadf4","#a6da95","#eed49f","#ed8796")},
 {id:"catppuccin-latte",name:"Catppuccin Latte",colors:light("#eff1f5","#ffffff","#e6e9ef","#4c4f69","#5c5f77","#8c8fa1","#1e66f5")},
 {id:"one-dark",name:"One Dark",colors:dark("#282c34","#21252b","#353b45","#abb2bf","#9da5b4","#5c6370","#61afef","#98c379","#e5c07b","#e06c75")},
 {id:"monokai",name:"Monokai",colors:dark("#272822","#1e1f1c","#3e3d32","#f8f8f2","#cfcfc2","#8f908a","#66d9ef","#a6e22e","#e6db74","#f92672")},
 {id:"ayu-dark",name:"Ayu Dark",colors:dark("#0b0e14","#0f1419","#1a1f29","#bfbdb6","#b3b1ad","#626a73","#e6b450","#aad94c","#ffb454","#f07178")},
 {id:"ayu-mirage",name:"Ayu Mirage",colors:dark("#1f2430","#242936","#303747","#cccac2","#b8c0cc","#707a8c","#ffcc66","#bae67e","#ffd580","#ff6666")},
 {id:"nord",name:"Nord",colors:dark("#2e3440","#3b4252","#434c5e","#eceff4","#d8dee9","#81a1c1","#88c0d0","#a3be8c","#ebcb8b","#bf616a")},
 {id:"solarized-dark",name:"Solarized Dark",colors:dark("#002b36","#073642","#0b4654","#eee8d5","#93a1a1","#657b83","#268bd2","#859900","#b58900","#dc322f")},
 {id:"solarized-light",name:"Solarized Light",colors:light("#fdf6e3","#eee8d5","#e5ddc7","#073642","#586e75","#839496","#268bd2")},
 {id:"rose-pine",name:"Rosé Pine",colors:dark("#191724","#1f1d2e","#26233a","#e0def4","#908caa","#6e6a86","#c4a7e7","#9ccfd8","#f6c177","#eb6f92")},
 {id:"everforest-dark",name:"Everforest Dark",colors:dark("#2d353b","#343f44","#3d484d","#d3c6aa","#a7c080","#859289","#83c092","#a7c080","#dbbc7f","#e67e80")},
];
export const getRiloTheme = (id: string) => {
  if (id === "dark") return riloThemes.find((t) => t.id === "rilo-default") || riloThemes[0];
  if (id === "light") return riloThemes.find((t) => t.id === "github-light") || riloThemes[0];
  return riloThemes.find((theme) => theme.id === id) || riloThemes[0];
};
