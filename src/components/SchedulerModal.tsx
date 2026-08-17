import { useState, useEffect } from "preact/hooks";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Checkbox } from "./ui/Checkbox";
import { CalendarClock, X } from "lucide-preact";

interface SchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SchedulerModal({ isOpen, onClose }: SchedulerModalProps) {
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startTime, setStartTime] = useState("22:00");
  const [stopTime, setStopTime] = useState("06:00");
  const [maxConcurrent, setMaxConcurrent] = useState(4);
  const [postAction, setPostAction] = useState("none");
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function loadScheduleSettings() {
      try {
        const enabled = await invoke<string | null>("get_setting", { key: "schedule_enabled" });
        const start = await invoke<string | null>("get_setting", { key: "schedule_start_time" });
        const stop = await invoke<string | null>("get_setting", { key: "schedule_stop_time" });
        const concurrent = await invoke<string | null>("get_setting", { key: "max_concurrent_downloads" });
        const action = await invoke<string | null>("get_setting", { key: "post_download_action" });

        if (isMounted) {
          if (enabled !== null) setScheduleEnabled(enabled === "true");
          if (start) setStartTime(start);
          if (stop) setStopTime(stop);
          if (concurrent) setMaxConcurrent(Number(concurrent) || 4);
          if (action) setPostAction(action);
        }
      } catch (err) {
        console.error("Error loading schedule settings:", err);
      }
    }
    loadScheduleSettings();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleSave = async () => {
    try {
      await invoke("save_setting", { key: "schedule_enabled", value: String(scheduleEnabled) });
      await invoke("save_setting", { key: "schedule_start_time", value: startTime });
      await invoke("save_setting", { key: "schedule_stop_time", value: stopTime });
      await invoke("save_setting", { key: "max_concurrent_downloads", value: String(maxConcurrent) });
      await invoke("save_setting", { key: "post_download_action", value: postAction });

      setSavedStatus("Settings saved successfully!");
      setTimeout(() => {
        setSavedStatus(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      setSavedStatus(`Error saving: ${err?.message || err}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-rilo-overlay backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl rilo-modal-shadow w-full max-w-md overflow-hidden text-xs text-rilo-primary space-y-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rilo-border pb-3">
          <div className="flex items-center space-x-2">
            <CalendarClock className="w-4 h-4 text-rilo-accent" />
            <h2 className="font-bold text-sm text-rilo-primary">Queue Scheduler</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          {/* Enable Schedule Checkbox */}
          <label className="flex items-center space-x-2.5 cursor-pointer bg-rilo-elevated border border-rilo-border p-3 rounded-lg">
            <Checkbox
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled((e.target as HTMLInputElement).checked)}
            />
            <div>
              <span className="font-semibold text-rilo-primary block">Enable Automated Schedule</span>
              <span className="text-[10px] text-rilo-muted">Automatically start/stop queue downloads at specified times</span>
            </div>
          </label>

          {/* Start / Stop Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-rilo-secondary">Start Queue Time</label>
              <Input
                type="time"
                disabled={!scheduleEnabled}
                value={startTime}
                onChange={(e) => setStartTime((e.target as HTMLInputElement).value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-rilo-secondary">Stop Queue Time</label>
              <Input
                type="time"
                disabled={!scheduleEnabled}
                value={stopTime}
                onChange={(e) => setStopTime((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          {/* Simultaneous Downloads */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-rilo-secondary">Maximum Simultaneous Downloads</label>
            <Select
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number((e.target as HTMLSelectElement).value))}
            >
              <option value={1}>1 download at a time</option>
              <option value={2}>2 downloads at a time</option>
              <option value={4}>4 downloads at a time (Default)</option>
              <option value={8}>8 downloads at a time</option>
            </Select>
          </div>

          {/* When Finished Action */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-rilo-secondary">When All Downloads Finish</label>
            <div className="space-y-1 bg-rilo-elevated border border-rilo-border p-3 rounded-lg">
              <label className="flex items-center space-x-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="postAction"
                  value="none"
                  checked={postAction === "none"}
                  onChange={() => setPostAction("none")}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className="text-rilo-primary">Do nothing</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="postAction"
                  value="notify"
                  checked={postAction === "notify"}
                  onChange={() => setPostAction("notify")}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className="text-rilo-primary">Show notification</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="postAction"
                  value="sleep"
                  checked={postAction === "sleep"}
                  onChange={() => setPostAction("sleep")}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className="text-rilo-primary">Put computer to sleep</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="postAction"
                  value="shutdown"
                  checked={postAction === "shutdown"}
                  onChange={() => setPostAction("shutdown")}
                  className="accent-indigo-600 cursor-pointer"
                />
                <span className="text-rilo-primary">Shut down computer</span>
              </label>
            </div>
          </div>
        </div>

        {/* Saved Status Indicator */}
        {savedStatus && (
          <p className="text-xs text-center font-mono text-rilo-accent">{savedStatus}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 border-t border-rilo-border pt-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button variant="default" size="sm" onClick={handleSave}>
            Save Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}
