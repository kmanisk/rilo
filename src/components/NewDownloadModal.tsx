import { useState, useEffect } from "preact/hooks";
import { open } from "@tauri-apps/plugin-dialog";
import { normalizeUrl, isArchiveFilename, getFileNameFromUrl } from "../utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Plus, X, FolderOpen, Download, Archive, Key, Clipboard } from "lucide-preact";

interface NewDownloadModalProps {
  onClose: () => void;
  onStartDownload: (
    url: string,
    customPath: string,
    connections: number,
    queueOnly?: boolean,
    autoExtract?: boolean,
    extractDir?: string,
    deleteArchiveAfterExtract?: boolean
  ) => void;
}

const SAMPLE_URLS = [
  { label: "100MB Hetzner", url: "https://ash-speed.hetzner.com/100MB.bin" },
  { label: "Sample ZIP", url: "https://github.com/expressjs/express/archive/refs/heads/master.zip" },
];

export default function NewDownloadModal({
  onClose,
  onStartDownload,
}: NewDownloadModalProps) {
  const [urlInput, setUrlInput] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [numConnections, setNumConnections] = useState<number>(4);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Archive Extraction State
  const [autoExtract, setAutoExtract] = useState(false);
  const [extractDir, setExtractDir] = useState("");
  const [deleteAfterExtract, setDeleteAfterExtract] = useState(false);

  const filename = getFileNameFromUrl(urlInput);
  const isArchive = isArchiveFilename(filename) || isArchiveFilename(urlInput);

  // Read clipboard explicitly on user action only
  const handlePasteFromClipboard = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setErrorMsg("Unable to read clipboard");
        return;
      }

      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setErrorMsg("No URL found in clipboard");
        return;
      }

      const urlMatch = text.match(/https?:\/\/[^\s"'<>\`]+/i);
      if (!urlMatch) {
        setErrorMsg("No URL found in clipboard");
        return;
      }

      let extractedUrl = urlMatch[0].trim().replace(/[.,;!)]+$/, "");
      const normalized = normalizeUrl(extractedUrl);

      if (normalized) {
        setUrlInput(normalized);
        setInfoMsg("URL pasted from clipboard");
      } else {
        setErrorMsg("No URL found in clipboard");
      }
    } catch (err) {
      console.warn("Clipboard read error:", err);
      setErrorMsg("Unable to read clipboard");
    }
  };

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBrowseFolder = async () => {
    try {
      setErrorMsg(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Save Directory",
      });
      if (selected && typeof selected === "string") {
        setCustomPath(selected);
      }
    } catch (err: any) {
      console.error("Folder picker error:", err);
      setErrorMsg(`Folder picker failed: ${err?.message || err}`);
    }
  };

  const handleBrowseExtractFolder = async () => {
    try {
      setErrorMsg(null);
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Extraction Directory",
      });
      if (selected && typeof selected === "string") {
        setExtractDir(selected);
      }
    } catch (err: any) {
      console.error("Extract folder picker error:", err);
    }
  };

  const handleSubmit = (queueOnly = false, targetUrl?: string) => {
    setErrorMsg(null);
    const rawUrl = targetUrl || urlInput;
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) {
      setErrorMsg("Please enter a valid URL address");
      return;
    }
    try {
      onStartDownload(
        normalized,
        customPath.trim(),
        numConnections,
        queueOnly,
        autoExtract,
        extractDir.trim(),
        deleteAfterExtract
      );
      onClose();
    } catch (err: any) {
      console.error("Task submission error:", err);
      setErrorMsg(`Failed to start download: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-fadeIn font-sans">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-rilo-surface border-b border-rilo-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-rilo-accent-muted border border-rilo-accent text-rilo-accent flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-rilo-primary uppercase tracking-wider">
              Add New Download Task
            </h3>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(false);
          }}
          className="p-5 space-y-4 text-xs"
        >
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-rose-400 text-[11px]">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-400 text-[11px] font-semibold">
              {infoMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-rilo-secondary">File URL (Address)</label>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Paste download URL (http:// or https://)..."
                value={urlInput}
                onInput={(e) => {
                  setUrlInput((e.target as HTMLInputElement).value);
                  setInfoMsg(null);
                  setErrorMsg(null);
                }}
                className="flex-1 py-2"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handlePasteFromClipboard}
                title="Paste URL from Clipboard"
                className="space-x-1 flex-shrink-0"
              >
                <Clipboard className="w-3.5 h-3.5 text-rilo-accent" />
                <span>Paste</span>
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-rilo-secondary">Save Path Location</label>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Default Downloads folder..."
                value={customPath}
                onInput={(e) => setCustomPath((e.target as HTMLInputElement).value)}
                className="flex-1 py-2"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleBrowseFolder}
                className="space-x-1"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse...</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-rilo-secondary">Threads (Connections)</label>
              <Select
                value={numConnections}
                onChange={(e) => setNumConnections(Number((e.target as HTMLSelectElement).value))}
              >
                <option value={1}>1 Thread (Single Stream)</option>
                <option value={4}>4 Threads (Segmented)</option>
                <option value={8}>8 Threads (High Speed)</option>
                <option value={16}>16 Threads (Max Speed)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-rilo-secondary">Presets</label>
              <div className="flex space-x-1 pt-0.5">
                {SAMPLE_URLS.map((sample) => (
                  <Button
                    key={sample.label}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setUrlInput(sample.url)}
                    className="flex-1 text-[10px]"
                  >
                    {sample.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Archive Extraction Section */}
          {isArchive && (
            <div className="bg-rilo-elevated border border-rilo-border rounded-lg p-3 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Archive className="w-4 h-4 text-rilo-accent" />
                  <span className="font-bold text-rilo-primary text-[11px]">Archive Options</span>
                </div>
                <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-rilo-primary font-semibold">
                  <input
                    type="checkbox"
                    checked={autoExtract}
                    onChange={(e) => setAutoExtract((e.target as HTMLInputElement).checked)}
                    className="rounded border-rilo-border text-rilo-accent focus:ring-rilo-accent"
                  />
                  <span>Extract after download</span>
                </label>
              </div>

              {autoExtract && (
                <div className="space-y-2 pt-1 border-t border-rilo-border">
                  <div className="space-y-1">
                    <label className="text-[10px] text-rilo-muted">Extract to:</label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="text"
                        placeholder="Same folder as downloaded file"
                        value={extractDir}
                        onInput={(e) => setExtractDir((e.target as HTMLInputElement).value)}
                        className="flex-1 py-1 text-[11px]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleBrowseExtractFolder}
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-rilo-secondary">
                    <input
                      type="checkbox"
                      checked={deleteAfterExtract}
                      onChange={(e) => setDeleteAfterExtract((e.target as HTMLInputElement).checked)}
                      className="rounded border-rilo-border text-rilo-accent focus:ring-rilo-accent"
                    />
                    <span>Delete archive after successful extraction</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-rilo-border">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => handleSubmit(true)}
            >
              Add to Queue
            </Button>
            <Button
              type="submit"
              variant="default"
              size="md"
              className="space-x-1 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Start Download</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
