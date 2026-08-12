import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],

  resolve: {
    alias: {
      react: "preact/compat",
      "react-dom/test-utils": "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Ignore Rust build output and Rust source code from Vite's frontend file watcher.
      // Tauri/Cargo CLI manages Rust compilation and watching independently.
      ignored: [
        "**/target/**",
        "target/**",
        "**/src-tauri/target/**",
        "src-tauri/target/**",
        "**/src-tauri/gen/**",
        "src-tauri/gen/**",
        "**/crates/**/target/**",
        "crates/**/target/**",
        "**/src-tauri/**",
        "**/.git/**",
      ],
    },
  },
});
