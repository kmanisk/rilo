import { useEffect, useRef } from "preact/hooks";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "./ui/Button";
import {
  Info,
  X,
  Heart,
  Github,
  Zap,
  Globe,
  ExternalLink,
  BookOpen,
  Tag,
  User,
} from "lucide-preact";

interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-rilo-overlay backdrop-blur-xs flex items-center justify-center p-4 select-none font-sans animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-rilo-surface border border-rilo-border rounded-2xl w-[540px] max-w-[95vw] rilo-modal-shadow overflow-hidden flex flex-col font-sans text-rilo-primary animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        {/* Titlebar Header */}
        <div className="bg-rilo-surface border-b border-rilo-border/80 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-md bg-rilo-elevated border border-rilo-border text-rilo-accent flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-rilo-accent" />
            </div>
            <h3 id="about-title" className="text-xs font-bold text-rilo-primary tracking-wide">
              About Rilo
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-rilo-muted hover:text-rilo-primary hover:bg-rilo-elevated transition-all duration-100 rounded-md cursor-pointer active:scale-95"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body: Two-Column Clean Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-12 min-h-[300px]">
          {/* Left Column: Branding, Version, Developer */}
          <div className="sm:col-span-5 p-5 flex flex-col items-center justify-between text-center border-b sm:border-b-0 sm:border-r border-rilo-border/60 bg-rilo-elevated/25">
            <div className="flex flex-col items-center space-y-2">
              {/* App Icon Squircle */}
              <div className="w-18 h-18 rounded-2xl bg-rilo-surface border border-rilo-border flex items-center justify-center p-3 shadow-md group transition-all duration-200 hover:border-rilo-accent/60 hover:shadow-lg">
                <img
                  src="/logo.png"
                  alt="Rilo Logo"
                  className="w-12 h-12 object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-105"
                />
              </div>

              <div>
                <h4 className="text-sm font-bold text-rilo-primary tracking-tight">
                  Rilo Download Manager
                </h4>
                <div className="inline-flex items-center space-x-1 text-[10px] font-mono text-rilo-accent bg-rilo-surface border border-rilo-subtle px-2.5 py-0.5 rounded-full mt-1 shadow-2xs">
                  <span>v1.1.0</span>
                </div>
              </div>

              <p className="text-[11px] text-rilo-muted leading-relaxed px-1">
                High-performance desktop download manager built for speed, resilience, and multi-connection acceleration.
              </p>
            </div>

            <div className="w-full pt-4 mt-2 border-t border-rilo-border/40 space-y-1 text-center">
              <div className="text-[11px] text-rilo-muted flex items-center justify-center space-x-1">
                <span>Developed with</span>
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
                <span>by</span>
                <button
                  type="button"
                  onClick={() => handleOpenLink("https://github.com/kmanisk")}
                  className="font-bold text-rilo-primary hover:text-rilo-accent transition-colors underline underline-offset-2 cursor-pointer"
                  title="View kmanisk on GitHub"
                >
                  kmanisk
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => handleOpenLink("https://github.com/kmanisk/rilo")}
                  className="text-[10px] text-rilo-muted hover:text-rilo-accent font-mono transition-colors truncate max-w-full cursor-pointer"
                >
                  github.com/kmanisk/rilo
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Feature Highlights & Interactive Links */}
          <div className="sm:col-span-7 p-5 flex flex-col justify-between space-y-3 bg-rilo-surface">
            <div className="space-y-2.5">
              {/* Card 1: Free & Open Source Software */}
              <button
                type="button"
                onClick={() => handleOpenLink("https://github.com/kmanisk/rilo")}
                className="w-full p-3 rounded-xl bg-rilo-elevated/60 hover:bg-rilo-elevated border border-rilo-border/80 hover:border-rilo-accent/50 text-left flex items-start space-x-3 transition-all duration-150 cursor-pointer group active:scale-[0.99] shadow-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-rilo-surface border border-rilo-border/80 flex items-center justify-center text-rilo-accent shrink-0 group-hover:border-rilo-accent/60 transition-colors">
                  <Github className="w-4 h-4 text-rilo-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-rilo-primary group-hover:text-rilo-accent transition-colors">
                      Free & Open Source Software
                    </h5>
                    <ExternalLink className="w-3 h-3 text-rilo-muted group-hover:text-rilo-accent opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                  <p className="text-[11px] text-rilo-muted leading-tight mt-0.5">
                    Explore the source code, open issues, and contribute on GitHub.
                  </p>
                </div>
              </button>

              {/* Card 2: High-Performance Rust Core */}
              <div className="p-3 rounded-xl bg-rilo-elevated/60 border border-rilo-border/80 text-left flex items-start space-x-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-rilo-surface border border-rilo-border/80 flex items-center justify-center text-rilo-accent shrink-0">
                  <Zap className="w-4 h-4 text-rilo-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-rilo-primary">
                    High-Performance Rust Core
                  </h5>
                  <p className="text-[11px] text-rilo-muted leading-tight mt-0.5">
                    Multi-threaded dynamic segment acceleration and token bucket rate limiting.
                  </p>
                </div>
              </div>

              {/* Card 3: Browser Integration & Range Resume */}
              <div className="p-3 rounded-xl bg-rilo-elevated/60 border border-rilo-border/80 text-left flex items-start space-x-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-rilo-surface border border-rilo-border/80 flex items-center justify-center text-rilo-accent shrink-0">
                  <Globe className="w-4 h-4 text-rilo-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-rilo-primary">
                    Browser Integration & HTTP Resume
                  </h5>
                  <p className="text-[11px] text-rilo-muted leading-tight mt-0.5">
                    Native browser extension IPC on port 15151 with HTTP Range byte resume.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="pt-2 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenLink("https://github.com/kmanisk/rilo")}
                  className="p-1.5 rounded-lg bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:border-rilo-accent/60 hover:bg-rilo-surface transition-all cursor-pointer active:scale-95"
                  title="View Repository on GitHub"
                >
                  <Github className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenLink("https://github.com/kmanisk/rilo/releases")}
                  className="p-1.5 rounded-lg bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:border-rilo-accent/60 hover:bg-rilo-surface transition-all cursor-pointer active:scale-95"
                  title="View Releases"
                >
                  <Tag className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenLink("https://github.com/kmanisk/rilo#readme")}
                  className="p-1.5 rounded-lg bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:border-rilo-accent/60 hover:bg-rilo-surface transition-all cursor-pointer active:scale-95"
                  title="Read Documentation"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenLink("https://github.com/kmanisk")}
                  className="p-1.5 rounded-lg bg-rilo-elevated border border-rilo-border text-rilo-secondary hover:text-rilo-primary hover:border-rilo-accent/60 hover:bg-rilo-surface transition-all cursor-pointer active:scale-95"
                  title="Developer Profile (@kmanisk)"
                >
                  <User className="w-4 h-4" />
                </button>
              </div>

              <Button
                ref={closeBtnRef as any}
                variant="default"
                size="sm"
                onClick={onClose}
                className="px-4"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
