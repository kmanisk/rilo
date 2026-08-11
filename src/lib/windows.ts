import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";

/**
 * Open or focus an independent native Tauri WebviewWindow for download details.
 */
export async function openDownloadDetailsWindow(downloadId: string, title?: string) {
  const cleanId = downloadId.replace(/[- ]/g, "_");
  const label = `rilo-download-details-${cleanId}`;

  try {
    console.info(`[Window] Requesting details window for: ${label}`);
    let existing: WebviewWindow | null = null;
    try {
      existing = await WebviewWindow.getByLabel(label);
    } catch (e) {
      console.info("[Window] getByLabel lookup note:", e);
    }

    if (existing) {
      console.info(`[Window] Existing details window found (${label}). Restoring focus.`);
      await existing.show();
      await existing.unminimize();
      await existing.setFocus();
      return;
    }

    try {
      await invoke("open_details_window", { downloadId, title: title || "Task Details" });
      console.info(`[Window] Native details window created via command: ${label}`);
    } catch (cmdErr: any) {
      const errStr = String(cmdErr?.message || cmdErr);
      if (errStr.includes("not found") || errStr.includes("no longer available") || errStr.includes("no longer exists")) {
        console.warn(`[Window] Download record missing, skipping window creation: ${errStr}`);
        throw new Error("Download is no longer available");
      }

      console.warn(`[Window] open_details_window command fallback to JS API:`, cmdErr);
      const url = `index.html?window=details&details_id=${encodeURIComponent(downloadId)}`;
      const win = new WebviewWindow(label, {
        url,
        title: `Download Details — ${title || downloadId}`,
        width: 560,
        height: 440,
        minWidth: 480,
        minHeight: 340,
        decorations: false,
        visible: false,
        center: true,
        resizable: true,
      });

      win.once("tauri://created", () => console.info(`[Window] Created JS details window: ${label}`));
      win.once("tauri://error", (err) => console.error(`[Window] Failed creating JS details window (${label}):`, err));
    }
  } catch (error) {
    console.error(`[Window] Error opening download details window (${label}):`, error);
    throw error;
  }
}

/**
 * Open or focus an independent native Tauri WebviewWindow for download completion notification.
 */
export async function openCompletionWindow(downloadId: string, title?: string) {
  const cleanId = downloadId.replace(/[- ]/g, "_");
  const label = `rilo-completion-${cleanId}`;

  try {
    console.info(`[Window] Requesting completion window for: ${label}`);
    let existing: WebviewWindow | null = null;
    try {
      existing = await WebviewWindow.getByLabel(label);
    } catch (e) {
      console.info("[Window] getByLabel lookup note:", e);
    }

    if (existing) {
      console.info(`[Window] Existing completion window found (${label}). Restoring focus.`);
      await existing.show();
      await existing.unminimize();
      await existing.setFocus();
      return;
    }

    try {
      await invoke("open_completion_window", { downloadId, title: title || downloadId });
      console.info(`[Window] Native completion window created via command: ${label}`);
    } catch (cmdErr) {
      console.warn(`[Window] open_completion_window command fallback to JS API:`, cmdErr);
      const url = `index.html?window=completion&completion_id=${encodeURIComponent(downloadId)}`;
      const win = new WebviewWindow(label, {
        url,
        title: `Completed — ${title || downloadId}`,
        width: 460,
        height: 260,
        minWidth: 420,
        minHeight: 220,
        decorations: false,
        visible: false,
        center: true,
        resizable: true,
      });

      win.once("tauri://created", () => console.info(`[Window] Created JS completion window: ${label}`));
      win.once("tauri://error", (err) => console.error(`[Window] Failed creating JS completion window (${label}):`, err));
    }
  } catch (error) {
    console.error(`[Window] Error opening completion window (${label}):`, error);
  }
}

/**
 * Open or focus the prototype native test window.
 */
export async function openTestWindow() {
  const label = "rilo-test-window";
  try {
    console.info("[TestWindow] Requesting test window...");
    let existing: WebviewWindow | null = null;
    try {
      existing = await WebviewWindow.getByLabel(label);
    } catch (e) {
      console.info("[TestWindow] getByLabel lookup note:", e);
    }

    if (existing) {
      console.info("[TestWindow] Existing test window found. Restoring focus.");
      await existing.show();
      await existing.unminimize();
      await existing.setFocus();
      return;
    }

    try {
      await invoke("open_test_window");
      console.info("[TestWindow] Native test window created via command");
    } catch (cmdErr) {
      console.warn("[TestWindow] open_test_window command fallback to JS API:", cmdErr);
      const win = new WebviewWindow(label, {
        url: "index.html?window=test",
        title: "Test Window",
        width: 600,
        height: 420,
        minWidth: 460,
        minHeight: 320,
        decorations: false,
        visible: false,
        center: true,
        resizable: true,
      });

      win.once("tauri://created", () => console.info("[TestWindow] Created JS test window"));
      win.once("tauri://error", (err) => console.error("[TestWindow] Creation error:", err));
    }
  } catch (error) {
    console.error("[TestWindow] Failed opening test window:", error);
  }
}
