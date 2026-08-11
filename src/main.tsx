import { render } from "preact";
import App from "./App";
import DetailsStandaloneView from "./components/DetailsStandaloneView";
import CompletionStandaloneView from "./components/CompletionStandaloneView";
import TestWindowView from "./components/TestWindowView";
import "./App.css";

// Disable default right-click context menu globally across all webview elements
document.addEventListener("contextmenu", (e) => e.preventDefault(), true);

// Intercept Caret Browsing (F7) and native browser keyboard shortcuts
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "F7" || e.keyCode === 118) {
      e.preventDefault();
      e.stopPropagation();
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

