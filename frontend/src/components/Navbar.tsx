"use client";

import { useEffect, useState } from "react";
import { Waves, Cpu, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { getSystemInfo } from "@/lib/api";
import { SystemInfo } from "@/lib/types";

interface NavbarProps {
  onOpenSynopsis: () => void;
}

export default function Navbar({ onOpenSynopsis }: NavbarProps) {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        const info = await getSystemInfo();
        if (isMounted) {
          setSysInfo(info);
          setIsOnline(true);
        }
      } catch {
        if (isMounted) {
          setSysInfo(null);
          setIsOnline(false);
        }
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-zinc-100 text-base">
                AquaVision
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300">
                UWIE AI
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Underwater Image Enhancement System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-xs">
            {isOnline === null ? (
              <span className="h-2 w-2 rounded-full bg-zinc-500 animate-pulse" />
            ) : isOnline ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
            )}

            <span className="text-zinc-300">
              {isOnline === null
                ? "Connecting..."
                : isOnline
                ? "Backend Ready"
                : "Backend Offline"}
            </span>

            {isOnline && sysInfo && (
              <span className="hidden items-center gap-1 border-l border-zinc-700 pl-2 text-[11px] text-zinc-400 md:inline-flex">
                <Cpu className="h-3 w-3 text-cyan-400" />
                {sysInfo.device.toUpperCase()}
                {sysInfo.model_loaded ? " (Model Loaded)" : " (CV Fallback)"}
              </span>
            )}
          </div>

          <button
            onClick={onOpenSynopsis}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
            title="Project Information & Architecture"
          >
            <Info className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Project Details</span>
          </button>
        </div>
      </div>
    </header>
  );
}
