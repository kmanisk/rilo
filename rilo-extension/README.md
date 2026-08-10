# Rilo Browser Extension (Chrome + Firefox)

Official browser extension for **Rilo Download Manager** (Manifest V3). Allows sending downloads from Google Chrome and Mozilla Firefox directly to the Rilo native desktop application.

---

## 🚀 Features

- **Context Menu Integration**: Right-click any link, image, or media file $\rightarrow$ **"Download with Rilo"**.
- **Current Page Interception**: One-click download of current tab content via the Rilo Extension Popup.
- **Native Messaging Bridge**: Uses `browser.runtime.sendNativeMessage` length-prefixed stdio protocol (`com.rilo.downloader`) for maximum security without exposing public HTTP endpoints.
- **Rilo Design System**: Built with Rilo's dark mode visual identity, typography, and status indicators.
- **Configurable Options**: Control automatic link interception and desktop completion toasts.

---

## 🛠️ Development & Unpacked Installation

### **1. Google Chrome / Chromium-based Browsers (Brave, Edge, Opera)**

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked** button.
4. Select the `rilo-extension/` directory.

### **2. Mozilla Firefox**

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** button.
3. Select `rilo-extension/manifest.json`.

---

## 🔌 Native Messaging Host Registration (Windows)

To allow Chrome and Firefox to communicate directly with `rilo.exe`:

1. Build the unified Rilo executable:
   ```bash
   cargo build --manifest-path src-tauri/Cargo.toml --release
   ```
2. Launching Rilo desktop application automatically registers `com.rilo.downloader` native messaging host manifests in Windows Registry (`HKCU\Software\Google\Chrome\NativeMessagingHosts` and `HKCU\Software\Mozilla\NativeMessagingHosts`).

---

## 🛡️ Security Protocol Specification

- Protocol: Length-prefixed JSON binary over `stdin`/`stdout`.
- Schema:
  ```json
  {
    "version": 1,
    "type": "download_request",
    "url": "https://example.com/file.zip",
    "filename": "file.zip",
    "referrer": "https://example.com/",
    "page_url": "https://example.com/"
  }
  ```
- URL Validation: Restricted strictly to `http://` and `https://` schemes. Unsafe schemes (`javascript:`, `file:`, `data:`) are rejected by the Rust native host.
