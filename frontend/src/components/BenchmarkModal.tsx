"use client";

import { useEffect, useState } from "react";
import {
  X,
  BarChart3,
  Download,
  Copy,
  Check,
  RefreshCw,
  Award,
  Zap,
  Activity,
  Layers,
  Sparkles,
  Info
} from "lucide-react";
import { fetchBenchmarkResults, downloadBenchmarkCSV, getBenchmarkLatex } from "@/lib/api";
import { BenchmarkPayload } from "@/lib/types";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BenchmarkModal({ isOpen, onClose }: BenchmarkModalProps) {
  const [data, setData] = useState<BenchmarkPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeDomain, setActiveDomain] = useState<string>("overall");
  const [copiedLatex, setCopiedLatex] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  const loadData = async (recalculate: boolean = false) => {
    setLoading(true);
    try {
      const res = await fetchBenchmarkResults(recalculate);
      setData(res);
    } catch (err) {
      console.error("Failed to load benchmark metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isOpen && !data) {
      fetchBenchmarkResults(false)
        .then((res) => {
          if (isMounted) setData(res);
        })
        .catch((err) => {
          console.error("Failed to load benchmark metrics:", err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLatex = async () => {
    try {
      const latex = await getBenchmarkLatex();
      await navigator.clipboard.writeText(latex);
      setCopiedLatex(true);
      setTimeout(() => setCopiedLatex(false), 2500);
    } catch (err) {
      console.error("Failed to copy LaTeX code:", err);
    }
  };

  const handleDownloadCsv = async () => {
    setIsExportingCsv(true);
    try {
      await downloadBenchmarkCSV();
    } catch (err) {
      console.error("Failed to download CSV:", err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-zinc-950 border border-cyan-800/40 rounded-2xl shadow-2xl overflow-hidden text-zinc-100"
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/30 text-cyan-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">
                  Quantitative Metrology & Model Benchmarks
                </h2>
                <span className="rounded-full bg-cyan-950/80 border border-cyan-700/50 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                  Milestone A
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Evaluation across UIEB, LSUI, EUVP & Unified Checkpoints vs. Classical Fallback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-cyan-500/50 transition-colors disabled:opacity-50"
              title="Re-run benchmark evaluation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              <span>{loading ? "Evaluating..." : "Re-evaluate"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Hardware & Academic Attribution Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
            <div>
              <span className="text-zinc-500 block">Host Hardware:</span>
              <span className="font-semibold text-cyan-300">
                {data?.gpu_name || "NVIDIA RTX 3050 Laptop GPU"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Metrology Suite:</span>
              <span className="text-zinc-200">
                UIQM, UCIQE, PSNR (dB), SSIM, Latency
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Research Supervisor:</span>
              <span className="text-zinc-200 font-medium">
                Mrs. Bhanupriya Sharma (IT Dept, ECA)
              </span>
            </div>
          </div>

          {/* Domain Filter Tabs */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {[
                { id: "overall", label: "Overall Mean" },
                { id: "coastal", label: "Coastal (UIEB)" },
                { id: "reefs", label: "Coral Reefs (LSUI)" },
                { id: "abyssal", label: "Deep Abyssal (EUVP)" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDomain(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeDomain === tab.id
                      ? "bg-cyan-500 text-zinc-950 font-semibold shadow-md shadow-cyan-500/20"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadCsv}
                disabled={isExportingCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-700/80 text-zinc-300 hover:text-cyan-300 transition-colors"
                title="Download CSV Table for Excel/Report"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleCopyLatex}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-700/80 text-zinc-300 hover:text-cyan-300 transition-colors"
                title="Copy LaTeX Table for Research Paper"
              >
                {copiedLatex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Copy LaTeX</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Benchmark Comparison Table */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Method / Checkpoint</th>
                    <th className="py-3 px-3">Dataset Scope</th>
                    <th className="py-3 px-3 text-right">
                      <span title="Underwater Image Quality Measure (Higher is Better)">UIQM &uarr;</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span title="Underwater Color Image Quality Evaluation (Higher is Better)">UCIQE &uarr;</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span title="Peak Signal-to-Noise Ratio in dB (Higher is Better)">PSNR (dB) &uarr;</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span title="Structural Similarity Index (Higher is Better)">SSIM &uarr;</span>
                    </th>
                    <th className="py-3 px-3 text-right">Latency</th>
                    <th className="py-3 px-4 text-right">Throughput</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {data?.models.map((m) => {
                    const isFlagship = m.id === "combined";
                    const isClassical = m.id === "classical";
                    
                    // Domain specific values or overall mean
                    const domainData = activeDomain !== "overall" && m.domain_breakdown ? m.domain_breakdown[activeDomain] : null;
                    const uiqmVal = domainData ? domainData.uiqm : m.mean_uiqm;
                    const uciqeVal = domainData ? domainData.uciqe : m.mean_uciqe;
                    const psnrVal = domainData ? domainData.psnr : m.mean_psnr;
                    const ssimVal = domainData ? domainData.ssim : m.mean_ssim;
                    const latVal = domainData ? domainData.latency_ms : m.latency_ms;
                    const fpsVal = m.fps;

                    return (
                      <tr
                        key={m.id}
                        className={`transition-colors ${
                          isFlagship
                            ? "bg-cyan-950/20 hover:bg-cyan-950/30"
                            : "hover:bg-zinc-900/50"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isFlagship ? (
                              <Award className="w-4 h-4 text-cyan-400 shrink-0" />
                            ) : isClassical ? (
                              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
                            )}
                            <div>
                              <div className={`font-semibold ${isFlagship ? "text-cyan-300" : "text-zinc-200"}`}>
                                {m.name}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                {m.checkpoint || "Rule-based Fallback"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px]">
                            {m.dataset_trained}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-cyan-400">
                          {uiqmVal ? uiqmVal.toFixed(3) : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-emerald-400">
                          {uciqeVal ? uciqeVal.toFixed(3) : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-300">
                          {psnrVal ? `${psnrVal.toFixed(2)} dB` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-300">
                          {ssimVal ? ssimVal.toFixed(3) : "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-zinc-400">
                          {latVal ? `${latVal.toFixed(1)} ms` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                          {fpsVal ? `${fpsVal} FPS` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Optical Findings & Metrology Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Finding Card 1 */}
            <div className="p-4 rounded-xl border border-cyan-900/40 bg-zinc-900/40 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>Underwater Optical Domain Adaptation</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                <strong className="text-zinc-200">LSUI model</strong> excels on turbid, green benthic coral reefs by suppressing chlorophyll scattering. In contrast, <strong className="text-zinc-200">EUVP model</strong> recovers extreme red-channel attenuation in dark abyssal depths. The <strong className="text-cyan-300">Unified Flagship (19k)</strong> reconciles these divergent distributions into an all-condition marine generalist.
              </p>
            </div>

            {/* Finding Card 2 */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Activity className="w-4 h-4" />
                <span>Real-Time Edge Preservation</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                By fusing low-resolution deep features (256x256) with high-resolution luminance gradients via <strong className="text-zinc-200">Guided Bilateral Upsampling</strong>, inference maintains <strong className="text-emerald-400">30+ FPS throughput</strong> on RTX 3050 (4GB) while preventing ringing artifacts on 1080p and 4K footage.
              </p>
            </div>

          </div>

          {/* Academic Citations & Standards Note */}
          <div className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/80 text-[11px] text-zinc-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-400">Optical Standards:</span> UIQM (Panetta et al., IEEE JOE) is computed via linear combination: <span className="font-mono text-zinc-300">0.0282*UICM + 0.2953*UISM + 3.5753*UIConM</span>. UCIQE (Yang & Xu, IEEE TIP) measures chroma variance, luminance contrast, and mean saturation.
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400">
          <span>AquaVision AI &bull; BTU Ajmer Final Year Capstone</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-medium text-zinc-950 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
