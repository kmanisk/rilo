import { useEffect, useState } from "preact/hooks";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { Button } from "./ui/Button";
import { Minus, Plus, Send, EyeOff, X, MonitorUp, Pin, AppWindow } from "lucide-preact";
import WindowChrome from "./window/WindowChrome";
import { applyVisualSettings } from "../lib/settings/visual";
import { AppConfig } from "./SettingsModal";
import { invoke } from "@tauri-apps/api/core";

export default function TestWindowView() {
  const [counter, setCounter] = useState(0);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [message, setMessage] = useState("Waiting for main-window message");
  const [isReady, setIsReady] = useState(false);
  const current = getCurrentWindow();

  useEffect(() => {
    let isMounted = true;

    async function initAppearance() {
      try {
        const appConfig = await invoke<AppConfig>("get_app_config");
        applyVisualSettings(appConfig.appearance);

        if (isMounted) {
          requestAnimationFrame(async () => {
            if (!isMounted) return;
            setIsReady(true);
            try {
              await current.show();
              await current.setFocus();
            } catch (err) {
              console.warn("Failed revealing test window:", err);
            }
          });
        }
      } catch (err) {
        console.error("Error loading app config in test window:", err);
      }
    }

    initAppearance();

    return () => {
      isMounted = false;
    };
  }, []);

  // Live Theme Switching Listener
  useEffect(() => {
    let unlistenTheme: UnlistenFn | undefined;

    async function setupThemeListener() {
      try {
        unlistenTheme = await listen<any>("rilo-appearance-changed", (event) => {
          applyVisualSettings(event.payload);
        });
      } catch (err) {
        console.error("Failed setting theme listener in test window:", err);
      }
    }

    setupThemeListener();

    return () => {
      if (unlistenTheme) unlistenTheme();
    };
  }, []);

  useEffect(() => {
    console.info("[TestWindow] URL loaded");
    let stop: UnlistenFn | undefined;
    listen<{ message: string }>("rilo-main-test-event", (event) => setMessage(event.payload.message))
      .then((unlisten) => {
        stop = unlisten;
      })
      .catch((error) => console.error("[TestWindow] event listener error:", error));
    return () => stop?.();
  }, []);

  const showMain = async () => {
    const main = await Window.getByLabel("main");
    if (main) {
      await main.show();
      await main.setFocus();
    }
  };

  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const revealClass = prefersReducedMotion
    ? "opacity-100"
    : isReady
    ? "opacity-100 transition-opacity duration-120 ease-out"
    : "opacity-0";

  return (
    <div className={`w-screen h-screen bg-rilo-bg text-rilo-primary flex flex-col overflow-hidden select-none font-sans ${revealClass}`}>
      <WindowChrome title="Test Window" subtitle="Independent native window" icon={MonitorUp} />

      <main className="flex-1 p-4 flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
        <div className="border border-rilo-border rounded-md bg-rilo-elevated p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-rilo-muted">Window label</span>
            <code>rilo-test-window</code>
          </div>
          <div className="flex justify-between">
            <span className="text-rilo-muted">Status</span>
            <span className="text-rilo-accent font-semibold">Connected</span>
          </div>
          <p className="text-[11px] text-rilo-secondary">{message}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => emit("rilo-test-event", { message: "Hello from test window" })}>
            <Send className="w-4 h-4 mr-1" />
            Send Test Event
          </Button>
          <Button variant="secondary" size="sm" onClick={() => current.hide()}>
            <EyeOff className="w-4 h-4 mr-1" />
            Hide
          </Button>
          <Button variant="danger" size="sm" onClick={() => current.close()}>
            <X className="w-4 h-4 mr-1" />
            Close Window
          </Button>
          <Button variant="secondary" size="sm" onClick={showMain}>
            <AppWindow className="w-4 h-4 mr-1" />
            Show Main Window
          </Button>
        </div>

        <label className="flex items-center gap-2 text-xs text-rilo-secondary">
          <input
            type="checkbox"
            checked={alwaysOnTop}
            onChange={async () => {
              const next = !alwaysOnTop;
              await current.setAlwaysOnTop(next);
              setAlwaysOnTop(next);
            }}
          />
          <Pin className="w-4 h-4 text-rilo-accent" />
          Always on top
        </label>

        <div className="border-t border-rilo-border pt-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Test counter</p>
            <p className="text-[11px] text-rilo-muted">Independent frontend state</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => setCounter(counter - 1)}>
              <Minus className="w-4 h-4" />
            </Button>
            <output className="w-10 text-center font-mono text-sm">{counter}</output>
            <Button variant="secondary" size="icon" onClick={() => setCounter(counter + 1)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
