import { render } from "preact";
import App from "./App";
import DetailsStandaloneView from "./components/DetailsStandaloneView";
import CompletionStandaloneView from "./components/CompletionStandaloneView";
import TestWindowView from "./components/TestWindowView";
import "./App.css";

// Disable default right-click context menu globally across all webview elements
document.addEventListener("contextmenu", (e) => e.preventDefault(), true);

// Suppress all native browser keyboard shortcuts (F12, DevTools, Find, View Source, Print, Save, Reload, Caret)
document.addEventListener(
  "keydown",
  (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    const key = e.key.toLowerCase();

    // 1. DevTools & View Source: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
    if (
      e.key === "F12" ||
      (cmdOrCtrl && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
      (cmdOrCtrl && key === "u")
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 2. Browser Find Bar & Settings: Ctrl+F, Ctrl+,
    if (
      (cmdOrCtrl && key === "f") ||
      e.key === "F3" ||
      (cmdOrCtrl && key === "g")
    ) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("rilo:focus-search"));
      return;
    }

    if (cmdOrCtrl && (e.key === "," || e.code === "Comma")) {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("rilo:toggle-settings"));
      return;
    }

    // 3. Print, Save Page, History, Browser Downloads: Ctrl+P, Ctrl+S, Ctrl+H, Ctrl+J
    if (
      cmdOrCtrl &&
      (key === "p" || key === "s" || key === "h" || key === "j")
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 4. Caret browsing (F7)
    if (e.key === "F7" || e.keyCode === 118) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 5. Browser Reloads: F5, Ctrl+R, Ctrl+Shift+R
    if (e.key === "F5" || (cmdOrCtrl && key === "r")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 6. Browser Back/Forward navigation: Alt+Left / Alt+Right or Backspace outside editable elements
    const isInput =
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable;

    if (!isInput) {
      if ((e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  },
  true
);

// Check window URL query parameters for standalone window modes
const params = new URLSearchParams(window.location.search);
const windowMode = params.get("window");
const detailsId = params.get("details_id");
const completionId = params.get("completion_id");

if (windowMode === "test") {
  render(<TestWindowView />, document.getElementById("root")!);
} else if (windowMode === "details" || detailsId) {
  const targetId = detailsId || params.get("id") || "";
  render(<DetailsStandaloneView downloadId={targetId} />, document.getElementById("root")!);
} else if (windowMode === "completion" || completionId) {
  const targetId = completionId || params.get("id") || "";
  render(<CompletionStandaloneView downloadId={targetId} />, document.getElementById("root")!);
} else {
  render(<App />, document.getElementById("root")!);
}

