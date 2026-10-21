"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Film, UploadCloud, Download, AlertCircle, Loader2, Sparkles } from "lucide-react";
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
      const res = await enhanceVideo(selectedFile, sideBySide, maxFrames);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Configuration & Upload Zone */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Upload & Options */}
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm lg:col-span-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Film className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Subsea Video Enhancement</h3>
          </div>

          {/* Drag & Drop Card */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-cyan-500 bg-cyan-950/20"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-950/10"
                : "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700"
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

            <UploadCloud className={`h-8 w-8 mb-2 ${selectedFile ? "text-emerald-400" : "text-cyan-400"}`} />
            <div className="text-xs font-medium text-zinc-200">
              {selectedFile ? selectedFile.name : "Choose an underwater video"}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {selectedFile
                ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                : "MP4, MOV, WEBM (Max 50 MB)"}
            </div>
          </div>

          {/* Video Processing Options */}
          <div className="space-y-3 pt-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
              <input
                type="checkbox"
                checked={sideBySide}
                onChange={(e) => setSideBySide(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500/20"
              />
              <span>Generate Side-by-Side Composite [RAW | ENHANCED]</span>
            </label>

            <div>
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                <span>Maximum Frames Limit</span>
                <span className="font-mono text-cyan-400">{maxFrames} frames</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={maxFrames}
                onChange={(e) => setMaxFrames(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                <span>50 (Quick)</span>
                <span>300 (Standard)</span>
                <span>500 (Extended)</span>
              </div>
            </div>

            <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800/80 text-[11px] text-zinc-400">
              <div className="font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                Anti-Flicker Temporal Consistency
              </div>
              Frames are blended using an Exponential Moving Average (EMA, &alpha;=0.25) to eradicate high-frequency underwater inter-frame flashing.
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleProcessVideo}
            disabled={!selectedFile || isProcessing}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Subsea Frames...
              </>
            ) : (
              <>
                <Film className="h-4 w-4" />
                Enhance Underwater Video
              </>
            )}
          </button>
        </div>

        {/* Right Column: Video Playback & Inspection */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isProcessing ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
                <span className="absolute h-full w-full rounded-full bg-cyan-500/20 animate-ping" />
                <Film className="h-8 w-8 text-cyan-400 animate-pulse" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Executing GPU-Accelerated Video Pipeline
              </h4>
              <p className="mt-1 max-w-md text-xs text-zinc-500">
                Extracting video frames, processing through AquaVisionNet with CUDA FP16, and applying anti-flicker temporal smoothing...
              </p>
            </div>
          ) : videoResult ? (
            <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {videoResult.filename}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {videoResult.stats.side_by_side
                      ? "Synchronized Side-by-Side Dual Stream"
                      : "AquaVision Enhanced Stream"}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-white active:scale-95 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download MP4
                </button>
              </div>

              {/* Video Player */}
              <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={resolveImageUrl(videoResult.enhanced_video_url)}
                  controls
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Video Telemetry Metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs pt-1">
                <div className="rounded-lg bg-zinc-950 p-2.5 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500">Frames Rendered</div>
                  <div className="font-semibold text-zinc-200 mt-0.5">
                    {videoResult.stats.frames_processed} / {videoResult.stats.total_frames}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-950 p-2.5 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500">Processing Rate</div>
                  <div className="font-semibold text-cyan-400 mt-0.5">
                    {videoResult.stats.average_fps} FPS
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-950 p-2.5 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500">Total Latency</div>
                  <div className="font-semibold text-zinc-200 mt-0.5">
                    {videoResult.stats.elapsed_seconds} s
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-950 p-2.5 border border-zinc-800/80">
                  <div className="text-[11px] text-zinc-500">Temporal Anti-Flicker</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">
                    EMA Active (&alpha;=0.25)
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center text-zinc-500">
              <Film className="mb-2 h-10 w-10 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-400">No Video Loaded</p>
              <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                Upload underwater diving, ROV, or benthic inspection video footage on the left to initiate GPU frame enhancement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
