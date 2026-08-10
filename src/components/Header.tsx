interface HeaderProps {
  totalSpeedBps: number;
  globalSpeedLimit: number;
  onSpeedLimitChange: (limitKb: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenAbout: () => void;
}

import { formatBytes } from "../utils";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Download } from "lucide-preact";

export default function Header({
  totalSpeedBps,
  globalSpeedLimit,
  onSpeedLimitChange,
  searchQuery,
  onSearchChange,
  onOpenAbout,
}: HeaderProps) {
  return (
    <header className="bg-rilo-surface border-b border-rilo-border px-4 py-2.5 flex items-center justify-between shadow-md select-none">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-rilo-accent text-white flex items-center justify-center shadow-md">
          <Download className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-sm font-extrabold text-rilo-primary tracking-wide flex items-center space-x-1.5">
            <span>RILO</span>
            <span className="text-[10px] bg-rilo-accent-muted text-rilo-accent px-1.5 py-0.2 rounded font-mono border border-rilo-accent">PRO</span>
          </h1>
          <p className="text-[10px] text-rilo-muted font-mono">Desktop Download Manager</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Live Aggregate Download Speed */}
        <div className="bg-rilo-elevated border border-rilo-border px-3 py-1 rounded text-xs font-mono flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-rilo-accent animate-pulse"></span>
          <span className="text-rilo-muted">Total Speed:</span>
          <span className="text-rilo-accent font-bold">{totalSpeedBps > 0 ? `${formatBytes(totalSpeedBps)}/s` : "0 B/s"}</span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Input
            type="text"
            placeholder="Search downloads..."
            value={searchQuery}
            onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
            className="w-40 sm:w-56"
          />
        </div>

        {/* Speed Limiter */}
        <div className="hidden md:flex items-center space-x-1.5 bg-rilo-elevated border border-rilo-border px-2 py-1 rounded text-xs">
          <span className="text-rilo-muted">Limit:</span>
          <Select
            value={globalSpeedLimit}
            onChange={(e) => onSpeedLimitChange(Number((e.target as HTMLSelectElement).value))}
            className="h-6 py-0 px-1 text-[11px] w-28"
          >
            <option value={0}>Unlimited</option>
            <option value={500}>500 KB/s</option>
            <option value={1024}>1 MB/s</option>
            <option value={5120}>5 MB/s</option>
            <option value={10240}>10 MB/s</option>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={onOpenAbout}>
          About
        </Button>
      </div>
    </header>
  );
}
