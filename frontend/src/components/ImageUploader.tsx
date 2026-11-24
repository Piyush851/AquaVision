"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, Check, Sparkles, Sliders, ChevronDown, ChevronUp, Image as ImageIcon, RotateCcw } from "lucide-react";
import { loadSampleAsFile } from "@/lib/api";
import { EnhancementResponse } from "@/lib/types";

const SAMPLE_PRESETS = [
  { id: "sample-1", name: "Reef Turbidity", domain: "Turbid Green", path: "/samples/sample-1.png" },
  { id: "sample-2", name: "Green Cast", domain: "Chlorophyll", path: "/samples/sample-2.png" },
  { id: "sample-3", name: "Low Contrast", domain: "Deep Benthic", path: "/samples/sample-3.png" },
  { id: "sample-4", name: "Deep Haze", domain: "Abyssal Blue", path: "/samples/sample-4.png" },
];

interface ImageUploaderProps {
  onProcess: (file: File, forceClassical: boolean) => Promise<void>;
  isLoading: boolean;
  activeResult?: EnhancementResponse | null;
}

export default function ImageUploader({
  onProcess,
  isLoading,
  activeResult,
}: ImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [forceClassical, setForceClassical] = useState(false);
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, JPEG, WEBP).");
      return;
    }
    setSelectedFile(file);
    setActiveSample(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
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

  const selectSample = async (sample: typeof SAMPLE_PRESETS[0]) => {
    try {
      setActiveSample(sample.id);
      const file = await loadSampleAsFile(sample.path, `${sample.id}.png`);
      setSelectedFile(file);
      setPreviewUrl(sample.path);
    } catch (err) {
      console.error("Failed to load sample:", err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    await onProcess(selectedFile, forceClassical);
  };

  // Compact bar state when an active result is already loaded and uploader is not explicitly expanded
  if (activeResult && !isExpanded) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5 backdrop-blur-md shadow-lg transition-all">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onFileInputChange(e);
            setIsExpanded(true);
          }}
        />

        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-100 truncate max-w-[200px] sm:max-w-xs">
                {selectedFile?.name || activeResult.filename || "Active Underwater Image"}
              </span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-mono border ${
                  forceClassical
                    ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                    : "bg-cyan-950/60 text-cyan-300 border-cyan-800/60"
                }`}
              >
                {forceClassical ? "Classical CV" : "Deep Learning"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              {activeResult.metrics?.original_dimensions || "1080p Optical Frame"} • Ready for Metrology Inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick-switch sample pills */}
          <div className="hidden lg:flex items-center gap-1.5 mr-1">
            {SAMPLE_PRESETS.slice(0, 2).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  selectSample(s);
                  setIsExpanded(true);
                }}
                className="text-[11px] px-2 py-1 rounded bg-zinc-950 border border-zinc-800 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-300 transition-colors"
                title={`Load ${s.name}`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-700/50 bg-cyan-950/50 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/60 hover:text-white transition-colors"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Upload New</span>
          </button>

          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Expand Full Ingestion Studio"
          >
            <span>Options</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md shadow-2xl transition-all">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* Header with Title & Collapse option if active result */}
      <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
              Underwater Optical Ingestion Studio
            </h2>
            <p className="text-[11px] text-zinc-400">
              Select or drop raw degraded footage to execute guided enhancement & optical metrology
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setActiveSample(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
          {activeResult && (
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <ChevronUp className="h-3 w-3" />
              <span>Collapse</span>
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Ingestion Hero Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column (7 cols): Dropzone & Benchmark Presets */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? "border-cyan-400 bg-cyan-950/25 shadow-lg shadow-cyan-950/40"
                : previewUrl
                ? "border-zinc-700 bg-zinc-950/70"
                : "border-zinc-800 bg-zinc-950/40 hover:border-cyan-500/50 hover:bg-zinc-900/50"
            }`}
          >
            {previewUrl ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="relative h-28 w-48 overflow-hidden rounded-lg border border-cyan-500/40 shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-zinc-200 truncate max-w-[260px]">
                    {selectedFile?.name || "Selected Image"}
                  </p>
                  <p className="text-[11px] text-cyan-400">
                    Click or drop another file to replace
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-400 group-hover:scale-105 transition-transform">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-zinc-200">
                  Drag & drop underwater footage, or{" "}
                  <span className="text-cyan-400 underline underline-offset-4">browse files</span>
                </p>
                <p className="text-[11px] text-zinc-500">
                  Supported formats: PNG, JPG, JPEG, WEBP, TIFF (Max 25 MB)
                </p>
              </div>
            )}
          </div>

          {/* Quick Benchmark Presets */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-400">Standard Optical Benchmark Datasets:</span>
              <span className="text-[10px] text-zinc-500">UIEB &bull; LSUI &bull; EUVP</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SAMPLE_PRESETS.map((sample) => {
                const isSelected = activeSample === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => selectSample(sample)}
                    className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all ${
                      isSelected
                        ? "border-cyan-400/80 bg-cyan-950/40 ring-1 ring-cyan-400/30"
                        : "border-zinc-800/90 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900/60"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sample.path}
                      alt={sample.name}
                      className="h-8 w-8 rounded-md object-cover border border-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-zinc-200 truncate">
                        {sample.name}
                      </div>
                      <div className="text-[9px] text-zinc-500 truncate font-mono">
                        {sample.domain}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Pipeline Configuration & Execution */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800/90 bg-zinc-950/50 p-4.5 lg:col-span-5">
          <div className="space-y-3.5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                Enhancement Strategy
              </span>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Select between deep neural tensor processing or zero-downtime classical optical equalization.
              </p>
            </div>

            {/* Model Selection Radios */}
            <div className="space-y-2">
              <div
                onClick={() => setForceClassical(false)}
                className={`cursor-pointer rounded-xl border p-3 transition-all ${
                  !forceClassical
                    ? "border-cyan-500/60 bg-cyan-950/20 shadow-sm"
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-xs text-zinc-200">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <span>AquaVisionNet Deep Learning</span>
                  </div>
                  {!forceClassical && <Check className="h-4 w-4 text-cyan-400" />}
                </div>
                <p className="mt-1 text-[11px] text-zinc-400 leading-normal pl-6">
                  Residual U-Net with Squeeze-and-Excitation attention & bilateral guided upsampling.
                </p>
              </div>

              <div
                onClick={() => setForceClassical(true)}
                className={`cursor-pointer rounded-xl border p-3 transition-all ${
                  forceClassical
                    ? "border-cyan-500/60 bg-cyan-950/20 shadow-sm"
                    : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-xs text-zinc-200">
                    <Sliders className="h-4 w-4 text-amber-400" />
                    <span>Classical CV Equalization</span>
                  </div>
                  {forceClassical && <Check className="h-4 w-4 text-amber-400" />}
                </div>
                <p className="mt-1 text-[11px] text-zinc-400 leading-normal pl-6">
                  Gray-World White Balance + LAB CLAHE color restoration (CPU/GPU Fallback).
                </p>
              </div>
            </div>
          </div>

          {/* Execute Button */}
          <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={!selectedFile || isLoading}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold shadow-lg transition-all ${
                !selectedFile || isLoading
                  ? "cursor-not-allowed bg-zinc-800 text-zinc-500 border border-zinc-750"
                  : "bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 text-zinc-950 shadow-cyan-950/60 hover:brightness-110 active:scale-[0.99]"
              }`}
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                  <span>Executing Optical Enhancement...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Enhance Underwater Image</span>
                </>
              )}
            </button>
            {!selectedFile && (
              <p className="mt-1.5 text-center text-[10px] text-zinc-500">
                Please select or drag an image above to activate processing.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
