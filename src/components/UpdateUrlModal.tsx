import { useState } from "preact/hooks";
import { normalizeUrl } from "../utils";
import { DownloadItem } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { RefreshCw, X } from "lucide-preact";

interface UpdateUrlModalProps {
  item: DownloadItem;
  onClose: () => void;
  onUpdateUrl: (item: DownloadItem, newUrl: string) => void;
}

export default function UpdateUrlModal({
  item,
  onClose,
  onUpdateUrl,
}: UpdateUrlModalProps) {
  const [newUrlInput, setNewUrlInput] = useState(item.url);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e?: Event) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    const normalized = normalizeUrl(newUrlInput);
    if (!normalized) {
      setErrorMsg("Please enter a valid URL address");
      return;
    }
    onUpdateUrl(item, normalized);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-rilo-surface border-b border-rilo-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-rilo-primary uppercase tracking-wide">
              Refresh Link / Update Address
            </h3>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="p-4 space-y-4 text-xs"
        >
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 text-rose-400 text-[11px]">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-rilo-secondary">Target File</label>
            <p className="text-rilo-primary font-bold truncate">{item.filename}</p>
            <p className="text-[10px] text-rilo-muted font-mono">ID: {item.id}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-rilo-secondary">New File URL (Address)</label>
            <Input
              type="text"
              placeholder="Paste new fresh download link..."
              value={newUrlInput}
              onInput={(e) => setNewUrlInput((e.target as HTMLInputElement).value)}
            />
            <p className="text-[10px] text-amber-400/80">
              Updating the link will preserve existing downloaded .part chunks on disk and resume directly from where it left off.
            </p>
          </div>

          <div className="pt-3 border-t border-rilo-border flex items-center justify-end space-x-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="amber"
              size="md"
              onClick={() => handleSubmit()}
              disabled={!newUrlInput.trim()}
            >
              Update & Resume
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
