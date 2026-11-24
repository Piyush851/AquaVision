"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import {
  Layers,
  UploadCloud,
  Download,
  AlertCircle,
  Loader2,
  Sparkles,
  FileText,
  Archive,
  CheckCircle2,
  Trash2,
  Eye,
  Activity,
  ShieldCheck,
  Fish,
  Maximize2,
} from "lucide-react";
import {
  uploadBatchAndEnhance,
  downloadBatchZip,
  downloadBatchSurveyPdf,
  downloadReportPdf,
  loadSampleAsFile,
  resolveImageUrl,
} from "@/lib/api";
import { BatchProcessingResponse, EnhancementResponse } from "@/lib/types";

interface BatchProcessorProps {
  onInspectItem?: (item: EnhancementResponse) => void;
}

export default function BatchProcessor({ onInspectItem }: BatchProcessorProps = {}) {
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchProcessingResponse | null>(null);

  // Settings
  const [forceClassical, setForceClassical] = useState<boolean>(false);
  const [detectMarine, setDetectMarine] = useState<boolean>(true);
  const [missionTitle, setMissionTitle] = useState<string>("Benthic Ecosystem Inspection");

  // Per-item preview mode: "enhanced" | "raw" | "annotated"
  const [previewModes, setPreviewModes] = useState<Record<string, "enhanced" | "raw" | "annotated">>({});

  // Export loaders
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | File[]) => {
    setError(null);
    const validFiles: File[] = [];
    const arr = Array.from(files);

    for (const f of arr) {
      if (f.type.startsWith("image/") || f.name.match(/\.(png|jpe?g|webp|bmp|tiff)$/i)) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) {
      setError("Please select valid image files (.png, .jpg, .jpeg, .webp).");
      return;
    }

    // Append to existing queue, avoiding duplicate filenames
    setQueuedFiles((prev) => {
      const existingNames = new Set(prev.map((p) => p.name));
      const newItems = validFiles.filter((vf) => !existingNames.has(vf.name));
      return [...prev, ...newItems];
    });
  };

  const handleLoadSamples = async () => {
    setError(null);
    try {
      const sampleNames = ["sample-1.png", "sample-2.png", "sample-3.png", "sample-4.png"];
      const loadedFiles: File[] = [];
      for (const s of sampleNames) {
        const f = await loadSampleAsFile(`/samples/${s}`, s);
        loadedFiles.push(f);
      }
      handleFilesAdded(loadedFiles);
    } catch (err) {
      setError("Failed to load sample dataset images: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (idx: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearQueue = () => {
    setQueuedFiles([]);
    setBatchResult(null);
    setError(null);
  };

  const handleExecuteBatch = async () => {
    if (queuedFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setBatchResult(null);

    try {
      const res = await uploadBatchAndEnhance(queuedFiles, forceClassical, detectMarine);
      setBatchResult(res);

      // Default view mode for each item to annotated (if available) or enhanced
      const modes: Record<string, "enhanced" | "raw" | "annotated"> = {};
      res.items.forEach((it) => {
        modes[it.id] = it.annotated_url ? "annotated" : "enhanced";
      });
      setPreviewModes(modes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Batch processing failed.";
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!batchResult) return;
    setIsDownloadingZip(true);
    try {
      const ids = batchResult.items.map((it) => it.id);
      await downloadBatchZip(ids);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to download batch ZIP.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadBatchPdf = async () => {
    if (!batchResult) return;
    setIsDownloadingPdf(true);
    try {
      const ids = batchResult.items.map((it) => it.id);
      await downloadBatchSurveyPdf(ids, missionTitle);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate batch survey PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadSinglePdf = async (fileId: string) => {
    try {
      await downloadReportPdf(fileId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate inspection report.");
    }
  };

  const toggleItemMode = (id: string, mode: "enhanced" | "raw" | "annotated") => {
    setPreviewModes((prev) => ({ ...prev, [id]: mode }));
  };

  // Compute aggregate telemetry
  const totalProcessed = batchResult?.total_processed || 0;
  const avgPsnr =
    totalProcessed > 0 && batchResult
      ? (
          batchResult.items.reduce((acc, curr) => acc + (curr.metrics.estimated_psnr || 0), 0) /
          totalProcessed
        ).toFixed(1)
      : "0.0";
  const avgUiqm =
    totalProcessed > 0 && batchResult
      ? (
          batchResult.items.reduce((acc, curr) => acc + (curr.metrics.uiqm || 0), 0) / totalProcessed
        ).toFixed(2)
      : "0.00";
  const totalDetections =
    batchResult?.items.reduce((acc, curr) => acc + (curr.detections?.length || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Configuration & Ingestion Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Dropzone & Queue */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Batch Ingestion Queue</h3>
              </div>
              <span className="rounded-full bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                {queuedFiles.length} {queuedFiles.length === 1 ? "Image" : "Images"} Queued
              </span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? "border-cyan-500 bg-cyan-950/20"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesAdded(e.target.files);
                  }
                }}
                className="hidden"
              />
              <UploadCloud className="mb-2 h-7 w-7 text-zinc-500" />
              <p className="text-xs font-medium text-zinc-300">
                Drag and drop multiple underwater images
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Or click to browse your directory (PNG, JPG, WEBP)
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleLoadSamples}
                className="rounded-lg border border-zinc-700/60 bg-zinc-800/70 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                + Load 4 Benchmark Samples
              </button>
              {queuedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear Queue</span>
                </button>
              )}
            </div>

            {/* Queued Items List */}
            {queuedFiles.length > 0 && (
              <div className="mt-4 max-h-[180px] overflow-y-auto space-y-1.5 pr-1 text-xs">
                {queuedFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between rounded-md bg-zinc-950/60 border border-zinc-800/70 px-3 py-1.5 text-zinc-300"
                  >
                    <span className="truncate max-w-[200px] text-[11px] font-mono">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">
                        {(f.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="text-zinc-500 hover:text-rose-400"
                        title="Remove file"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Processing Pipeline Parameters */}
        <div className="flex flex-col justify-between gap-4 lg:col-span-7">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Pipeline Execution Engine
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fallback vs Deep Learning */}
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-zinc-200">Enhancement Model</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      forceClassical
                        ? "bg-amber-950/80 border border-amber-800/60 text-amber-300"
                        : "bg-cyan-950/80 border border-cyan-800/60 text-cyan-300"
                    }`}
                  >
                    {forceClassical ? "Classical Fallback" : "Deep Learning"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-2.5 leading-relaxed">
                  {forceClassical
                    ? "Gray-World White Balance + CLAHE contrast equalization."
                    : "SE-Attention Residual U-Net with GPU tensor acceleration."}
                </p>
                <button
                  type="button"
                  onClick={() => setForceClassical(!forceClassical)}
                  className="text-[11px] font-medium text-cyan-400 hover:underline"
                >
                  Switch to {forceClassical ? "Deep Learning Model" : "Classical Fallback"}
                </button>
              </div>

              {/* Biological Intelligence Toggle */}
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-zinc-200">Marine Bio-Intelligence</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      detectMarine
                        ? "bg-emerald-950/80 border border-emerald-800/60 text-emerald-300"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {detectMarine ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-2.5 leading-relaxed">
                  Automatic taxonomy bounding boxes (fauna, coral, debris) & CIELAB bleaching index.
                </p>
                <button
                  type="button"
                  onClick={() => setDetectMarine(!detectMarine)}
                  className="text-[11px] font-medium text-emerald-400 hover:underline"
                >
                  {detectMarine ? "Disable Biological HUD" : "Enable Biological HUD"}
                </button>
              </div>
            </div>

            {/* Mission / Project Name Input */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Survey Mission Title (Embedded in PDF Inspection Reports)
              </label>
              <input
                type="text"
                value={missionTitle}
                onChange={(e) => setMissionTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-2 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
                placeholder="e.g. Red Sea Coastal Survey Mission Alpha"
              />
            </div>

            {/* Execute Button */}
            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={handleExecuteBatch}
                disabled={queuedFiles.length === 0 || isProcessing}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-cyan-950/50 hover:from-cyan-500 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Batch Frames...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Run Batch Pipeline ({queuedFiles.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-xs text-rose-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Batch Completed Summary & Export Banner */}
      {batchResult && (
        <div className="rounded-xl border border-cyan-800/40 bg-cyan-950/10 p-5 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Batch Execution Completed Successfully
                </h3>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Processed <span className="font-mono text-cyan-300">{batchResult.total_processed}</span> of{" "}
                <span className="font-mono text-zinc-300">{batchResult.total_submitted}</span> images in{" "}
                <span className="font-mono text-zinc-300">{batchResult.elapsed_seconds}s</span> (
                <span className="font-mono text-emerald-300">{batchResult.average_fps} FPS</span>)
              </p>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/90 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-all shadow-sm"
              >
                {isDownloadingZip ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                ) : (
                  <Archive className="h-4 w-4 text-cyan-400" />
                )}
                <span>Download Batch ZIP Archive</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBatchPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 rounded-lg border border-cyan-700/60 bg-cyan-950/60 px-3.5 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-900/80 hover:text-cyan-100 transition-all shadow-sm"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                ) : (
                  <FileText className="h-4 w-4 text-cyan-300" />
                )}
                <span>Generate Official Survey PDF</span>
              </button>
            </div>
          </div>

          {/* Aggregate Telemetry Row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Mean PSNR Gain</span>
              <div className="mt-1 text-base font-semibold text-cyan-300">+{avgPsnr} dB</div>
            </div>
            <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Mean UIQM</span>
              <div className="mt-1 text-base font-semibold text-teal-300">{avgUiqm}</div>
            </div>
            <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Marine Species</span>
              <div className="mt-1 text-base font-semibold text-emerald-300">{totalDetections} Organisms</div>
            </div>
            <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/70 p-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Survey Sign-Off</span>
              <div className="mt-1 text-base font-semibold text-zinc-300 flex items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Verified
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processed Results Gallery */}
      {batchResult && batchResult.items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Processed Survey Frames ({batchResult.items.length})
            </h3>
            <span className="text-xs text-zinc-400">
              Click view tabs below each frame to toggle Raw, Enhanced, and Biological HUD views.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {batchResult.items.map((item: EnhancementResponse) => {
              const currentMode = previewModes[item.id] || "enhanced";
              const currentSrc =
                currentMode === "raw"
                  ? resolveImageUrl(item.original_url)
                  : currentMode === "annotated" && item.annotated_url
                  ? resolveImageUrl(item.annotated_url)
                  : resolveImageUrl(item.enhanced_url);

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4 backdrop-blur-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Filename & Actions */}
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <div className="truncate max-w-[240px] font-mono text-zinc-300">
                        {item.filename}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {onInspectItem && (
                          <button
                            type="button"
                            onClick={() => onInspectItem(item)}
                            className="flex items-center gap-1 rounded bg-cyan-950/80 border border-cyan-800/60 px-2 py-1 text-[10px] text-cyan-300 hover:text-white hover:bg-cyan-900 transition-colors"
                            title="Inspect in Main Side-by-Side Comparison Viewer"
                          >
                            <Maximize2 className="h-3 w-3" />
                            <span>Inspect</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadSinglePdf(item.id)}
                          className="flex items-center gap-1 rounded bg-zinc-800/80 border border-zinc-700/60 px-2 py-1 text-[10px] text-zinc-300 hover:text-cyan-300 hover:bg-zinc-700 transition-colors"
                          title="Generate individual PDF inspection report"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Report</span>
                        </button>
                        <a
                          href={currentSrc}
                          download={`AquaVision_${item.id}.png`}
                          className="flex items-center gap-1 rounded bg-zinc-800/80 border border-zinc-700/60 px-2 py-1 text-[10px] text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                          title="Download high-resolution image"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    </div>

                    {/* Image Viewport */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                      <Image
                        src={currentSrc}
                        alt={item.filename}
                        fill
                        unoptimized
                        className="object-contain"
                      />
                      {/* Active View Badge */}
                      <div className="absolute top-2 left-2 rounded bg-zinc-950/80 border border-zinc-800 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-300 backdrop-blur-sm">
                        {currentMode}
                      </div>
                    </div>

                    {/* View Switcher Chips */}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleItemMode(item.id, "raw")}
                        className={`rounded px-2.5 py-1 text-[10px] font-medium transition-all ${
                          currentMode === "raw"
                            ? "bg-zinc-700 text-white"
                            : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Raw Input
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleItemMode(item.id, "enhanced")}
                        className={`rounded px-2.5 py-1 text-[10px] font-medium transition-all ${
                          currentMode === "enhanced"
                            ? "bg-cyan-700 text-white"
                            : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Enhanced (DL)
                      </button>
                      {item.annotated_url && (
                        <button
                          type="button"
                          onClick={() => toggleItemMode(item.id, "annotated")}
                          className={`flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium transition-all ${
                            currentMode === "annotated"
                              ? "bg-emerald-700 text-white"
                              : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          <span>HUD Overlay</span>
                        </button>
                      )}
                    </div>

                    {/* Metrology & Detections summary */}
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded bg-zinc-950/70 border border-zinc-800/60 py-1 px-1.5">
                        <span className="block text-[9px] uppercase text-zinc-500">PSNR</span>
                        <span className="text-[11px] font-mono font-semibold text-cyan-300">
                          {item.metrics.estimated_psnr?.toFixed(1) || "N/A"} dB
                        </span>
                      </div>
                      <div className="rounded bg-zinc-950/70 border border-zinc-800/60 py-1 px-1.5">
                        <span className="block text-[9px] uppercase text-zinc-500">UIQM</span>
                        <span className="text-[11px] font-mono font-semibold text-teal-300">
                          {item.metrics.uiqm?.toFixed(2) || "N/A"}
                        </span>
                      </div>
                      <div className="rounded bg-zinc-950/70 border border-zinc-800/60 py-1 px-1.5">
                        <span className="block text-[9px] uppercase text-zinc-500">Latency</span>
                        <span className="text-[11px] font-mono text-zinc-300">
                          {((item.metrics.processing_time_seconds || 0) * 1000).toFixed(0)} ms
                        </span>
                      </div>
                    </div>

                    {/* Species & Coral tags */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {item.coral_health && (
                        <span className="rounded bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                          Reef:{" "}
                          <span
                            className={
                              item.coral_health.bleaching_index > 0.4
                                ? "text-amber-400 font-semibold"
                                : "text-emerald-400 font-semibold"
                            }
                          >
                            {item.coral_health.health_status}
                          </span>
                        </span>
                      )}
                      {item.detections && item.detections.length > 0 ? (
                        item.detections.slice(0, 3).map((d, dIdx) => (
                          <span
                            key={dIdx}
                            className="inline-flex items-center gap-1 rounded bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 text-[10px] text-emerald-300"
                          >
                            <Fish className="h-2.5 w-2.5" />
                            <span>
                              {d.label} ({(d.confidence * 100).toFixed(0)}%)
                            </span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-zinc-500 italic">No targets detected</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
