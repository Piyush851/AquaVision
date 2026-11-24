"use client";

import { useState, useRef, MouseEvent, TouchEvent, useEffect } from "react";
import { Download, Maximize2, ZoomIn, ZoomOut, RotateCcw, FileText, Loader2, X } from "lucide-react";
import { resolveImageUrl, downloadReportPdf } from "@/lib/api";
import { MarineDetection } from "@/lib/types";

interface ComparisonViewerProps {
  originalUrl: string;
  enhancedUrl: string;
  annotatedUrl?: string | null;
  filename?: string;
  resultId?: string;
  detections?: MarineDetection[] | null;
}

export default function ComparisonViewer({
  originalUrl,
  enhancedUrl,
  annotatedUrl,
  filename = "enhanced-image.png",
  resultId,
  detections,
}: ComparisonViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenView, setFullscreenView] = useState<"side-by-side" | "enhanced" | "original">("side-by-side");
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showDetections, setShowDetections] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const fullOriginalUrl = resolveImageUrl(originalUrl);
  const fullEnhancedUrl = resolveImageUrl(enhancedUrl);
  const fullAnnotatedUrl = annotatedUrl ? resolveImageUrl(annotatedUrl) : null;
  const displayEnhancedUrl = showDetections && fullAnnotatedUrl ? fullAnnotatedUrl : fullEnhancedUrl;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Keyboard navigation (Escape to exit fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (zoom > 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (zoom > 1 && e.touches.length === 1) {
      setIsPanning(true);
      panStartRef.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    }
  };

  useEffect(() => {
    const handleMouseUp = () => setIsPanning(false);
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      }
    };
    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (isPanning && e.touches[0]) {
        setPan({
          x: e.touches[0].clientX - panStartRef.current.x,
          y: e.touches[0].clientY - panStartRef.current.y,
        });
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
  }, [isPanning]);

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
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm">
        {/* Top Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tracking-tight text-zinc-200">
              Enhancement Comparison
            </span>
            {zoom > 1 && (
              <span className="rounded bg-cyan-950/70 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                {Math.round(zoom * 100)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              {zoom > 1 && (
                <button
                  onClick={handleResetZoom}
                  className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                  title="Reset Zoom & Pan"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Biological Detection HUD Toggle (without icon per requirement) */}
            <button
              onClick={() => setShowDetections(!showDetections)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                showDetections
                  ? "bg-cyan-500 text-zinc-950 font-semibold shadow-md shadow-cyan-500/20"
                  : "bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
              title="Toggle Marine Biological & Coral Detection Overlay"
            >
              <span>Biological Overlay</span>
              {detections && detections.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    showDetections
                      ? "bg-zinc-950 text-cyan-300 font-bold"
                      : "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
                  }`}
                >
                  {detections.length}
                </span>
              )}
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={() => {
                setIsFullscreen(true);
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-colors"
              title="Open Fullscreen View"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            {/* Download Report PDF */}
            {resultId && (
              <button
                onClick={async () => {
                  setIsExportingPdf(true);
                  try {
                    await downloadReportPdf(resultId);
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 hover:border-cyan-600 transition-colors disabled:opacity-50"
                title="Download Official Marine Inspection PDF Report"
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-cyan-400" />
                )}
                <span className="hidden sm:inline">Report PDF</span>
              </button>
            )}

            {/* Download Image Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-cyan-500 transition-colors"
              title="Download Enhanced Image"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Comparison Area */}
        <div
          className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 min-h-[350px] sm:min-h-[460px]"
        >
          <div className="grid h-full w-full grid-cols-1 gap-2 p-2 sm:grid-cols-2">
            {/* Raw Original */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-900/40 p-1">
              <span className="absolute top-2 left-2 z-10 rounded bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300 border border-zinc-800">
                Original (Raw)
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullOriginalUrl}
                alt="Original Underwater"
                className="max-h-[440px] w-full object-contain transition-transform duration-75 select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: "center center",
                }}
              />
            </div>

            {/* Enhanced Output */}
            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-900/40 p-1">
              <span className="absolute top-2 left-2 z-10 rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-medium text-cyan-300 border border-cyan-800/50">
                {showDetections ? "Enhanced + Biological HUD" : "Enhanced (AquaVision)"}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayEnhancedUrl}
                alt="Enhanced Underwater"
                className="max-h-[440px] w-full object-contain transition-transform duration-75 select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-zinc-500">
          {zoom > 1
            ? "Click and drag to pan across high-frequency underwater textures."
            : "Side-by-side optical comparison of raw input vs. deep-enhanced output."}
        </p>
      </div>

      {/* True Fullscreen Interactive Lightbox Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => {
            if (zoom === 1) setIsFullscreen(false);
          }}
        >
          {/* Fullscreen Top Header Bar */}
          <div
            className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-6 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-zinc-100">{filename}</span>
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
                <button
                  onClick={() => setFullscreenView("side-by-side")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    fullscreenView === "side-by-side"
                      ? "bg-cyan-500 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setFullscreenView("enhanced")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    fullscreenView === "enhanced"
                      ? "bg-cyan-500 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  Enhanced Only
                </button>
                <button
                  onClick={() => setFullscreenView("original")}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    fullscreenView === "original"
                      ? "bg-cyan-500 text-zinc-950"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  Original Only
                </button>
              </div>
            </div>

            {/* Fullscreen Toolbar Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 4}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <span className="px-2 font-mono text-cyan-300 min-w-[50px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                {zoom > 1 && (
                  <button
                    onClick={handleResetZoom}
                    className="rounded p-1 text-cyan-400 hover:bg-zinc-800"
                    title="Fit to Screen"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Exit Fullscreen Button */}
              <button
                onClick={() => {
                  setIsFullscreen(false);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-200 transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <X className="h-4 w-4" />
                <span>Exit</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Viewer Display Area */}
          <div
            className="flex-1 w-full overflow-hidden flex items-center justify-center p-4 select-none cursor-grab active:cursor-grabbing"
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            {fullscreenView === "side-by-side" ? (
              <div className="grid h-full w-full grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative flex items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                  <span className="absolute top-3 left-3 z-10 rounded bg-zinc-950/80 px-2.5 py-1 text-xs font-medium text-zinc-300 border border-zinc-800">
                    Original (Raw)
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fullOriginalUrl}
                    alt="Original"
                    className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-75"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: "center center",
                    }}
                  />
                </div>
                <div className="relative flex items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                  <span className="absolute top-3 left-3 z-10 rounded bg-cyan-950/80 px-2.5 py-1 text-xs font-medium text-cyan-300 border border-cyan-800/50">
                    {showDetections ? "Enhanced + Biological HUD" : "Enhanced Output"}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayEnhancedUrl}
                    alt="Enhanced"
                    className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-75"
                    style={{
                      transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                      transformOrigin: "center center",
                    }}
                  />
                </div>
              </div>
            ) : fullscreenView === "enhanced" ? (
              <div className="relative h-full w-full flex items-center justify-center overflow-hidden">
                <span className="absolute top-3 left-3 z-10 rounded bg-cyan-950/80 px-2.5 py-1 text-xs font-medium text-cyan-300 border border-cyan-800/50">
                  {showDetections ? "Enhanced + Biological HUD" : "Enhanced Output"}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayEnhancedUrl}
                  alt="Enhanced"
                  className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            ) : (
              <div className="relative h-full w-full flex items-center justify-center overflow-hidden">
                <span className="absolute top-3 left-3 z-10 rounded bg-zinc-950/80 px-2.5 py-1 text-xs font-medium text-zinc-300 border border-zinc-800">
                  Original (Raw)
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullOriginalUrl}
                  alt="Original"
                  className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-75"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
