"use client";

import { useState, useRef, MouseEvent, TouchEvent, useCallback, useEffect } from "react";
import { Download, Columns, SplitSquareVertical, Maximize2, Minimize2 } from "lucide-react";
import { resolveImageUrl } from "@/lib/api";

interface ComparisonViewerProps {
  originalUrl: string;
  enhancedUrl: string;
  filename?: string;
}

export default function ComparisonViewer({
  originalUrl,
  enhancedUrl,
  filename = "enhanced-image.png",
}: ComparisonViewerProps) {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const fullOriginalUrl = resolveImageUrl(originalUrl);
  const fullEnhancedUrl = resolveImageUrl(enhancedUrl);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const width = rect.width;
      const percentage = Math.min(Math.max((x / width) * 100, 0), 100);
      setSliderPosition(percentage);
    },
    []
  );

  const onMouseDown = () => setIsDragging(true);
  const onTouchStart = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };
    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchend", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isDragging, handleMove]);

  const handleDownload = async () => {
    try {
      const response = await fetch(fullEnhancedUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename.endsWith(".png") ? filename : `${filename}-enhanced.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(fullEnhancedUrl, "_blank");
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tracking-tight text-zinc-200">
            Enhancement Comparison
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
            Interactive
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              onClick={() => setViewMode("slider")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === "slider"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Split Slider View"
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Slider</span>
            </button>
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                viewMode === "side-by-side"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Side-by-Side View"
            >
              <Columns className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Side-by-Side</span>
            </button>
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white active:scale-95 transition-all"
            title="Download Enhanced Image"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Comparison Area */}
      <div
        className={`relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 ${
          isFullscreen
            ? "fixed inset-4 z-50 flex items-center justify-center bg-zinc-950/95 p-4 shadow-2xl"
            : "min-h-[350px] sm:min-h-[460px]"
        }`}
      >
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-50 rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Close Fullscreen
          </button>
        )}

        {viewMode === "slider" ? (
          <div
            ref={containerRef}
            className="relative h-full w-full select-none overflow-hidden flex items-center justify-center cursor-ew-resize min-h-[350px] sm:min-h-[460px]"
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            {/* Enhanced Image (Background layer) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullEnhancedUrl}
              alt="Enhanced Underwater"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />

            {/* Original Image (Foreground layer clipped to slider position) */}
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullOriginalUrl}
                alt="Original Raw Underwater"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain max-w-none"
                style={{
                  width: containerRef.current
                    ? `${containerRef.current.clientWidth}px`
                    : "100%",
                }}
              />
            </div>

            {/* Slider Dividing Bar */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/90 text-[10px] font-bold text-zinc-200 shadow-md">
                ‹ ›
              </div>
            </div>

            {/* Floating Badges */}
            <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-zinc-950/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 backdrop-blur-sm border border-zinc-800">
              Original (Raw)
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-cyan-950/80 px-2 py-0.5 text-[11px] font-medium text-cyan-300 backdrop-blur-sm border border-cyan-800/50">
              Enhanced (AquaVision)
            </div>
          </div>
        ) : (
          /* Side by Side Mode */
          <div className="grid h-full w-full grid-cols-1 gap-2 p-2 sm:grid-cols-2">
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-900/40 p-1">
              <span className="absolute top-2 left-2 z-10 rounded bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300 border border-zinc-800">
                Original (Raw)
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullOriginalUrl}
                alt="Original Underwater"
                className="max-h-[440px] w-full object-contain"
              />
            </div>

            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-900/40 p-1">
              <span className="absolute top-2 left-2 z-10 rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-medium text-cyan-300 border border-cyan-800/50">
                Enhanced (AquaVision)
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullEnhancedUrl}
                alt="Enhanced Underwater"
                className="max-h-[440px] w-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === "slider" && (
        <p className="text-center text-[11px] text-zinc-500">
          Drag slider or hover horizontally to compare color restoration and detail preservation
        </p>
      )}
    </div>
  );
}
