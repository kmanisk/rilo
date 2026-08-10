import { render } from "preact";
import App from "./App";
import DetailsStandaloneView from "./components/DetailsStandaloneView";
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
const detailsId = params.get("details_id");

if (detailsId) {
  render(<DetailsStandaloneView downloadId={detailsId} />, document.getElementById("root")!);
} else {
  render(<App />, document.getElementById("root")!);
}
