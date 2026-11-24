"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Film, UploadCloud, Download, AlertCircle, Loader2, Sparkles, Sliders, CheckCircle2, RotateCcw } from "lucide-react";
import { enhanceVideo, resolveImageUrl } from "@/lib/api";

const MAX_VIDEO_SIZE_MB = 50;

export default function VideoProcessor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [videoResult, setVideoResult] = useState<{
    id: string;
    filename: string;
    enhanced_video_url: string;
    raw_video_url: string;
    stats: {
      average_fps: number;
      frames_processed: number;
      total_frames: number;
      elapsed_seconds: number;
      side_by_side: boolean;
    };
  } | null>(null);

  const [sideBySide, setSideBySide] = useState<boolean>(true);
  const [maxFrames, setMaxFrames] = useState<number>(300);
  const [emaAlpha, setEmaAlpha] = useState<number>(0.25);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (file: File) => {
    setError(null);
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)) {
      setError("Please select a valid video container (.mp4, .mov, .avi, .webm).");
      return;
    }
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
      setError(`Video size (${fileSizeMB.toFixed(1)} MB) exceeds the 50 MB upload limit.`);
      return;
    }
    setSelectedFile(file);
    setVideoResult(null);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleProcessVideo = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await enhanceVideo(selectedFile, sideBySide, maxFrames, emaAlpha);
      setVideoResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Subsea video enhancement failed.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!videoResult) return;
    const url = resolveImageUrl(videoResult.enhanced_video_url);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AquaVision_Enhanced_${videoResult.filename || "subsea_video"}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Configuration & Upload Zone */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (5 cols): Upload & Pipeline Parameters */}
        <div className="flex flex-col justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md shadow-xl lg:col-span-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Film className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Subsea Video Engine</h3>
                  <p className="text-[11px] text-zinc-400">GPU Anti-Flicker Temporal Pipeline</p>
                </div>
              </div>
              {selectedFile && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setVideoResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-zinc-400 hover:text-rose-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Drag & Drop Card */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-950/30"
                  : selectedFile
                  ? "border-emerald-500/50 bg-emerald-950/15"
                  : "border-zinc-800 bg-zinc-950/50 hover:border-cyan-500/50 hover:bg-zinc-900/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  if (e.target.files && e.target.files[0]) handleFileChange(e.target.files[0]);
                }}
                className="hidden"
              />

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 mb-2">
                <UploadCloud className={`h-6 w-6 ${selectedFile ? "text-emerald-400" : "text-cyan-400"}`} />
              </div>

              <div className="text-xs font-semibold text-zinc-200 truncate max-w-[260px]">
                {selectedFile ? selectedFile.name : "Select or Drop Underwater Video"}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for GPU Processing`
                  : "MP4, MOV, WEBM, AVI (Max 50 MB)"}
              </div>
            </div>

            {/* Pipeline Configuration Parameters */}
            <div className="space-y-3.5 pt-1">
              {/* Output Mode Switcher */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                  Composition Mode
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSideBySide(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                      sideBySide
                        ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <span>Side-by-Side Dual</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSideBySide(false)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                      !sideBySide
                        ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <span>Enhanced Only</span>
                  </button>
                </div>
              </div>

              {/* Anti-Flicker Temporal Consistency Slider */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                    Anti-Flicker Blend (&alpha;)
                  </span>
                  <span className="font-mono text-cyan-400 text-xs font-semibold">{emaAlpha.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.45"
                  step="0.05"
                  value={emaAlpha}
                  onChange={(e) => setEmaAlpha(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>0.10 (High Motion)</span>
                  <span>0.25 (Optimal)</span>
                  <span>0.45 (Max Smoothing)</span>
                </div>
              </div>

              {/* Frame Limitation Slider */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                    Max Frame Limit
                  </span>
                  <span className="font-mono text-cyan-400 font-semibold">{maxFrames} frames</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={maxFrames}
                  onChange={(e) => setMaxFrames(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>50 (Fast Demo)</span>
                  <span>300 (Standard)</span>
                  <span>500 (Extended)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Execution Button */}
          <button
            onClick={handleProcessVideo}
            disabled={!selectedFile || isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 py-3 text-xs font-semibold text-white shadow-lg shadow-cyan-950/60 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Executing Subsea Video Stream...</span>
              </>
            ) : (
              <>
                <Film className="h-4 w-4" />
                <span>Enhance Underwater Video</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column (7 cols): Playback & Metrology Telemetry */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isProcessing ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center shadow-xl">
              <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-cyan-500/20 animate-ping" />
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-950 border border-cyan-500/50 text-cyan-400">
                  <Film className="h-7 w-7 animate-pulse" />
                </div>
              </div>
              <h4 className="text-base font-semibold text-zinc-100">
                Processing Subsea Video Stream
              </h4>
              <p className="mt-2 max-w-md text-xs text-zinc-400 leading-relaxed">
                Extracting sequential frames, executing AquaVisionNet SE-Attention with CUDA FP16, and calculating exponential moving average anti-flicker stability.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-4 py-1.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>CUDA Pipeline Active &bull; Max {maxFrames} Frames</span>
              </div>
            </div>
          ) : videoResult ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-100 truncate max-w-sm">
                      {videoResult.filename}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {videoResult.stats.side_by_side
                      ? "Synchronized Side-by-Side Dual Stream [RAW | ENHANCED]"
                      : "AquaVision Enhanced Video Stream"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={restartVideo}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
                    title="Restart Playback"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Replay</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-500 active:scale-95 transition-all shadow-md"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download MP4</span>
                  </button>
                </div>
              </div>

              {/* Synchronized Video Player Viewport */}
              <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black aspect-video flex items-center justify-center shadow-inner group">
                <video
                  ref={videoRef}
                  src={resolveImageUrl(videoResult.enhanced_video_url)}
                  controls
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Video Performance & Optical Telemetry */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs pt-1">
                <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Rendered Frames</div>
                  <div className="font-semibold text-zinc-200 mt-1 text-sm font-mono">
                    {videoResult.stats.frames_processed} / {videoResult.stats.total_frames}
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Throughput Rate</div>
                  <div className="font-semibold text-cyan-400 mt-1 text-sm font-mono">
                    {videoResult.stats.average_fps} FPS
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Pipeline Latency</div>
                  <div className="font-semibold text-zinc-200 mt-1 text-sm font-mono">
                    {videoResult.stats.elapsed_seconds} s
                  </div>
                </div>
                <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Temporal Anti-Flicker</div>
                  <div className="font-semibold text-emerald-400 mt-1 text-sm font-mono">
                    EMA Active (&alpha;={emaAlpha.toFixed(2)})
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-zinc-500 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 mb-3 text-zinc-600">
                <Film className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Awaiting Video Ingestion</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm leading-relaxed">
                Upload diving, ROV, or benthic inspection video footage on the left to initiate real-time anti-flicker enhancement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
