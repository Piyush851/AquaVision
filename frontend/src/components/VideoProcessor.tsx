"use client";

import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import { Film, UploadCloud, Download, AlertCircle, Sparkles, Sliders, CheckCircle2, RotateCcw, Clock, Timer } from "lucide-react";
import { enhanceVideo, resolveImageUrl } from "@/lib/api";

const MAX_VIDEO_SIZE_MB = 50;

export default function VideoProcessor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
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

  // Enhancement parameters
  const [sideBySide, setSideBySide] = useState<boolean>(true);
  const [maxFrames, setMaxFrames] = useState<number>(300);
  const [emaAlpha, setEmaAlpha] = useState<number>(0.25);
  const [forceClassical, setForceClassical] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live timer tracking while video processes
  useEffect(() => {
    if (!isProcessing) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isProcessing]);

  const handleFileChange = (file: File) => {
    if (isProcessing) return;
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
    if (!isProcessing) setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleProcessVideo = async () => {
    if (!selectedFile || isProcessing) return;
    setElapsedSeconds(0);
    setIsProcessing(true);
    setError(null);

    try {
      const res = await enhanceVideo(
        selectedFile,
        sideBySide,
        maxFrames,
        emaAlpha,
        forceClassical
      );
      setVideoResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Subsea video enhancement failed.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!videoResult || isDownloading) return;
    setIsDownloading(true);
    try {
      const url = resolveImageUrl(videoResult.enhanced_video_url);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch video stream for download");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `AquaVision_Enhanced_${videoResult.filename || "subsea_video"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.warn("Direct blob download failed, falling back to direct stream link:", err);
      const directUrl = resolveImageUrl(videoResult.enhanced_video_url);
      const link = document.createElement("a");
      link.href = directUrl;
      link.download = `AquaVision_Enhanced_${videoResult.filename || "subsea_video"}.mp4`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Autoplay or seek interrupted:", err);
      });
    }
  };

  // ETA Calculation based on maxFrames and standard processing rate (~18 FPS)
  const estimatedTotalSec = Math.max(3, Math.round(maxFrames / 18));
  const remainingSec = Math.max(0, estimatedTotalSec - elapsedSeconds);
  const progressPercent = Math.min(95, Math.max(5, Math.round((elapsedSeconds / estimatedTotalSec) * 100)));

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
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
                </div>
              </div>
              {selectedFile && !isProcessing && (
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
              onClick={() => {
                if (!isProcessing) fileInputRef.current?.click();
              }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                isProcessing
                  ? "opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-950/40"
                  : isDragging
                  ? "border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-950/30 cursor-pointer"
                  : selectedFile
                  ? "border-emerald-500/50 bg-emerald-950/15 cursor-pointer"
                  : "border-zinc-800 bg-zinc-950/50 hover:border-cyan-500/50 hover:bg-zinc-900/40 cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={isProcessing}
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
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Enhancement`
                  : "MP4, MOV, WEBM, AVI (Max 50 MB)"}
              </div>
            </div>

            {/* Pipeline Configuration Parameters (Locked during processing) */}
            <div className={`space-y-3.5 pt-1 ${isProcessing ? "opacity-50 pointer-events-none cursor-not-allowed" : ""}`}>
              {/* Enhancement Engine Selector */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                  Enhancement Model
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setForceClassical(false)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                      !forceClassical
                        ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>AquaVisionNet</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setForceClassical(true)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                      forceClassical
                        ? "border-cyan-500/60 bg-cyan-950/40 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <Sliders className="h-3 w-3" />
                    <span>Classical CV</span>
                  </button>
                </div>
              </div>

              {/* Output Mode Switcher */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                  Composition Mode
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
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
                    disabled={isProcessing}
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
                  disabled={isProcessing}
                  value={emaAlpha}
                  onChange={(e) => setEmaAlpha(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer disabled:cursor-not-allowed"
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
                  disabled={isProcessing}
                  value={maxFrames}
                  onChange={(e) => setMaxFrames(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer disabled:cursor-not-allowed"
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
            <Film className="h-4 w-4" />
            <span>{isProcessing ? "Processing Video Stream..." : "Enhance Underwater Video"}</span>
          </button>
        </div>

        {/* Right Column (7 cols): Playback, Timer HUD & Telemetry */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isProcessing ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center shadow-xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 mb-4">
                <Film className="h-8 w-8" />
              </div>

              <h4 className="text-base font-semibold text-zinc-100">
                Enhancing Subsea Video Stream
              </h4>
              <p className="mt-1.5 max-w-md text-xs text-zinc-400 leading-relaxed">
                Applying frame-by-frame {forceClassical ? "classical equalization" : "AquaVisionNet SE-Attention"} with anti-flicker temporal smoothing (&alpha;={emaAlpha.toFixed(2)}).
              </p>

              {/* Real-Time Estimated Finish Timer HUD */}
              <div className="mt-6 w-full max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <span>Elapsed: <strong className="font-mono text-zinc-100">{formatTime(elapsedSeconds)}</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Timer className="h-4 w-4 text-teal-400" />
                    <span>Est. Finish: <strong className="font-mono text-teal-300">~{formatTime(estimatedTotalSec)}</strong></span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-1000"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Target: {maxFrames} frames</span>
                    <span className="font-mono text-cyan-400 font-medium">
                      {remainingSec > 0 ? `~${remainingSec}s remaining` : "Finalizing video..."}
                    </span>
                  </div>
                </div>
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
                    title="Restart Playback from Beginning"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Replay</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-500 active:scale-95 transition-all shadow-md disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{isDownloading ? "Downloading..." : "Download MP4"}</span>
                  </button>
                </div>
              </div>

              {/* Synchronized Video Player Viewport */}
              <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black aspect-video flex items-center justify-center shadow-inner group">
                <video
                  ref={videoRef}
                  key={videoResult.enhanced_video_url}
                  src={resolveImageUrl(videoResult.enhanced_video_url)}
                  controls
                  playsInline
                  preload="auto"
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
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Anti-Flicker Blend</div>
                  <div className="font-semibold text-emerald-400 mt-1 text-sm font-mono">
                    &alpha; = {emaAlpha.toFixed(2)}
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
                Upload diving, ROV, or benthic inspection video footage on the left to initiate real-time enhancement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
