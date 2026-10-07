"use client";

import { Activity, Clock, Layers, Sparkles } from "lucide-react";
import { EnhancementMetrics } from "@/lib/types";

interface MetricsPanelProps {
  metrics: EnhancementMetrics;
}

export default function MetricsPanel({ metrics }: MetricsPanelProps) {
  const isDeepLearning = metrics.inference_mode === "deep-learning";
  const latencyMs = Math.round(metrics.processing_time_seconds * 1000);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Inference & Quality Telemetry
        </h3>
        <span className="text-[11px] text-zinc-500">
          Device: {metrics.device.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* PSNR */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs">Est. PSNR</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-zinc-100">
              {metrics.estimated_psnr.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-500">dB</span>
          </div>
        </div>

        {/* Latency */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs">Inference Time</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg font-semibold tracking-tight text-zinc-100">
              {latencyMs}
            </span>
            <span className="text-xs text-zinc-500">ms</span>
          </div>
        </div>

        {/* Engine */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs">Method</span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold tracking-tight text-zinc-100">
            {isDeepLearning ? "AquaVisionNet" : "Classical CV"}
          </div>
          <span className="text-[10px] text-zinc-500 truncate block">
            {isDeepLearning ? "Residual U-Net" : "CLAHE + WB"}
          </span>
        </div>

        {/* Resolution */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs">Resolution</span>
          </div>
          <div className="mt-1 text-sm font-semibold tracking-tight text-zinc-100">
            {metrics.original_dimensions || "Original"}
          </div>
          <span className="text-[10px] text-zinc-500">Full Scale Preserved</span>
        </div>
      </div>
    </div>
  );
}
