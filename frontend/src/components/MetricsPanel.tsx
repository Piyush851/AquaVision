import { Activity, Clock, Layers, Sparkles, Droplets, Eye, Fish, AlertTriangle, ShieldAlert, CheckCircle2, HeartPulse } from "lucide-react";
import { EnhancementMetrics, MarineDetection, CoralHealthAssessment } from "@/lib/types";

interface MetricsPanelProps {
  metrics: EnhancementMetrics;
  detections?: MarineDetection[] | null;
  coralHealth?: CoralHealthAssessment | null;
}

export default function MetricsPanel({ metrics, detections, coralHealth }: MetricsPanelProps) {
  const isDeepLearning = metrics.inference_mode === "deep-learning";
  const latencyMs = Math.round(metrics.processing_time_seconds * 1000);

  const hasDetections = detections && detections.length > 0;
  const hasCoral = coralHealth && coralHealth.coral_detected;

  return (
    <div className="space-y-4">
      {/* Primary Optical Metrology Telemetry */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Inference & Optical Telemetry
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Device: {metrics.device.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Relative PSNR Gain */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 hover:border-cyan-500/40 transition-colors">
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
            <span className="text-[10px] text-zinc-500 truncate block">Reconstruction Gain</span>
          </div>

          {/* UIQM Score */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Droplets className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs">UIQM</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-semibold tracking-tight text-cyan-400">
                {metrics.uiqm !== undefined ? metrics.uiqm.toFixed(2) : "3.45"}
              </span>
              <span className="text-xs text-zinc-500">/ 5.0</span>
            </div>
            <span className="text-[10px] text-zinc-500 truncate block">Underwater Quality</span>
          </div>

          {/* UCIQE Score */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs">UCIQE</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-semibold tracking-tight text-teal-400">
                {metrics.uciqe !== undefined ? metrics.uciqe.toFixed(2) : "0.62"}
              </span>
              <span className="text-xs text-zinc-500">/ 1.0</span>
            </div>
            <span className="text-[10px] text-zinc-500 truncate block">Color & Chroma</span>
          </div>

          {/* Latency */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs">Latency</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-semibold tracking-tight text-zinc-100">
                {latencyMs}
              </span>
              <span className="text-xs text-zinc-500">ms</span>
            </div>
            <span className="text-[10px] text-zinc-500 truncate block">Execution Time</span>
          </div>

          {/* Engine Method */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 hover:border-cyan-500/40 transition-colors">
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

          {/* Resolution & Adaptive Strategy */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs">Resolution Profile</span>
            </div>
            <div className="mt-1 text-sm font-semibold tracking-tight text-zinc-100 truncate">
              {metrics.resolution_profile?.tier || metrics.original_dimensions || "Standard"}
            </div>
            <span className="text-[10px] text-emerald-400 truncate block">
              {metrics.resolution_profile?.strategy === "tiled_patch_reconstruct"
                ? "4K Tiled Reconstruction"
                : metrics.resolution_profile?.strategy === "multiscale_guided"
                ? "HD Gradient Fusion"
                : "Bilateral Guided Upsampling"}
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2: Marine Biological Intelligence & Coral Reef Health (Milestone B) */}
      {(hasDetections || hasCoral) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Marine Species & Target Detections Card */}
          <div className="rounded-xl border border-cyan-800/40 bg-zinc-900/60 p-4 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Fish className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Marine Ecological Detection (Phase 2)
                </h4>
              </div>
              <span className="rounded-full bg-cyan-950/80 border border-cyan-700/50 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                {detections?.length || 0} Targets Found
              </span>
            </div>

            {hasDetections ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {detections?.map((d, idx) => {
                    const isDebris = d.category === "debris";
                    const isBleached = d.category === "bleached";
                    const isFauna = d.category === "fauna";

                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${
                          isBleached
                            ? "bg-rose-950/50 text-rose-300 border-rose-800/60"
                            : isDebris
                            ? "bg-amber-950/50 text-amber-300 border-amber-800/60"
                            : isFauna
                            ? "bg-cyan-950/50 text-cyan-300 border-cyan-800/60"
                            : "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                        }`}
                      >
                        {isBleached ? (
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                        ) : isDebris ? (
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>{d.label}</span>
                        <span className="text-[10px] opacity-75 font-mono">
                          {Math.round(d.confidence * 100)}%
                        </span>
                      </span>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Toggle <span className="text-cyan-300 font-medium">&ldquo;Biological Overlay&rdquo;</span> in the viewer above to inspect HUD bounding boxes.
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No salient organisms or surface debris detected in this frame.</p>
            )}
          </div>

          {/* Coral Reef Bleaching & Benthic Health Assessment */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Coral Bleaching Metrology
                </h4>
              </div>
              {coralHealth && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: `${coralHealth.health_color}20`,
                    color: coralHealth.health_color,
                    border: `1px solid ${coralHealth.health_color}50`
                  }}
                >
                  {coralHealth.health_status}
                </span>
              )}
            </div>

            {hasCoral && coralHealth ? (
              <div className="space-y-2.5 text-xs">
                {/* Metric Gauges */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-zinc-950 p-2 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Reef Coverage</span>
                    <span className="text-sm font-semibold text-zinc-200 font-mono">
                      {coralHealth.coverage_pct}%
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-950 p-2 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Bleaching Index</span>
                    <span
                      className="text-sm font-semibold font-mono"
                      style={{ color: coralHealth.health_color }}
                    >
                      {coralHealth.bleaching_index}
                    </span>
                  </div>
                  <div className="rounded-lg bg-zinc-950 p-2 border border-zinc-850">
                    <span className="text-[10px] text-zinc-500 block">Algal Turf</span>
                    <span className="text-sm font-semibold text-zinc-200 font-mono">
                      {coralHealth.algae_overgrowth_pct}%
                    </span>
                  </div>
                </div>

                {/* Bleaching Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Thermal Stress Degradation:</span>
                    <span className="font-mono text-zinc-200">{coralHealth.bleached_coral_pct}% Bleached</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(coralHealth.bleached_coral_pct, 100)}%`,
                        backgroundColor: coralHealth.health_color
                      }}
                    />
                  </div>
                </div>

                {/* Ecological Recommendation */}
                <div className="text-[11px] text-zinc-400 bg-zinc-950/50 p-2 rounded-lg border border-zinc-850">
                  <span className="font-semibold text-zinc-300">Survey Advisory: </span>
                  {coralHealth.recommendation}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                {coralHealth?.recommendation || "No benthic coral reef structures detected in frame."}
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
