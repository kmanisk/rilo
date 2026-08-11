import { Button } from "./ui/Button";

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-rilo-overlay backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-rilo-surface border border-rilo-border rounded-xl max-w-md w-full shadow-2xl p-5 space-y-4">
        <div className="flex items-center space-x-3 border-b border-rilo-border pb-3">
          <img src="/favicon-32x32.png" alt="Rilo Logo" className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-md" />
          <div>
            <h3 className="text-base font-bold text-rilo-primary">Rilo Download Manager</h3>
            <p className="text-xs text-rilo-accent font-mono">v1.0.0 (Production Release)</p>
          </div>
        </div>

        <div className="text-xs text-rilo-secondary space-y-2 leading-relaxed">
          <p>
            Rilo is a high-performance desktop download manager featuring multi-threaded dynamic segment acceleration, queue scheduling, and automatic link recovery.
          </p>
          <div className="bg-rilo-elevated p-3 rounded border border-rilo-border space-y-1 font-mono text-[11px] text-rilo-muted">
            <p><span className="text-rilo-accent">&bull; Core Engine:</span> High-speed Multi-segment Downloader</p>
            <p><span className="text-rilo-accent">&bull; Integration:</span> Local Browser Extension Port 7899</p>
            <p><span className="text-rilo-accent">&bull; Features:</span> HTTP Range Resume, Token Bucket Rate Limiting</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="default" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
