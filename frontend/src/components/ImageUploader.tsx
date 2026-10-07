"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, Image as ImageIcon, Sliders, Check, Sparkles } from "lucide-react";
import { loadSampleAsFile } from "@/lib/api";

const SAMPLE_PRESETS = [
  { id: "sample-1", name: "Reef Turbidity", path: "/samples/sample-1.png" },
  { id: "sample-2", name: "Green Cast", path: "/samples/sample-2.png" },
  { id: "sample-3", name: "Low Contrast", path: "/samples/sample-3.png" },
  { id: "sample-4", name: "Deep Haze", path: "/samples/sample-4.png" },
];

interface ImageUploaderProps {
  onProcess: (file: File, forceClassical: boolean) => Promise<void>;
  isLoading: boolean;
}

export default function ImageUploader({ onProcess, isLoading }: ImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [forceClassical, setForceClassical] = useState(false);
  const [activeSample, setActiveSample] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-tight text-zinc-200">
          Source Underwater Image
        </h2>
        {selectedFile && (
          <button
            onClick={() => {
              setSelectedFile(null);
              setPreviewUrl(null);
              setActiveSample(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center transition-all ${
          isDragging
            ? "border-cyan-400 bg-cyan-950/20"
            : previewUrl
            ? "border-zinc-700 bg-zinc-950/50"
            : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileInputChange}
        />

        {previewUrl ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-28 w-44 overflow-hidden rounded border border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected preview"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-xs text-zinc-300 truncate max-w-[220px]">
              {selectedFile?.name || "Selected Image"}
            </p>
            <p className="text-[11px] text-zinc-500">Click or drop to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <div className="rounded-full bg-zinc-800 p-2.5 text-zinc-300">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-zinc-200">
              Drag & drop underwater image here, or{" "}
              <span className="text-cyan-400 underline underline-offset-2">browse</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Supports PNG, JPG, JPEG, WEBP
            </p>
          </div>
        )}
      </div>

      {/* Quick Sample Presets */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-400">
          Or try sample benchmark images:
        </p>
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
                    ? "border-cyan-400/80 bg-cyan-950/30"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.path}
                  alt={sample.name}
                  className="h-7 w-7 rounded object-cover"
                />
                <span className="text-[11px] text-zinc-300 truncate">
                  {sample.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Enhancement Mode Selector */}
      <div className="flex flex-col gap-1.5 pt-1">
        <label className="text-xs font-medium text-zinc-400">
          Enhancement Engine
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForceClassical(false)}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              !forceClassical
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Neural Net (U-Net)</span>
          </button>

          <button
            type="button"
            onClick={() => setForceClassical(true)}
            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
              forceClassical
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Classical CV (CLAHE)</span>
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || isLoading}
        className={`mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-medium transition-all ${
          !selectedFile || isLoading
            ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
            : "bg-cyan-500 text-zinc-950 hover:bg-cyan-400 active:scale-[0.99]"
        }`}
      >
        {isLoading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
            <span>Processing Enhancement...</span>
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" />
            <span>Enhance Underwater Image</span>
          </>
        )}
      </button>
    </div>
  );
}
