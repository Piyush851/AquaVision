import { useState, useRef, MouseEvent, TouchEvent, useCallback, useEffect } from "react";
import { Download, Columns, SplitSquareVertical, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, FileText, Loader2, Eye, Fish } from "lucide-react";
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
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showDetections, setShowDetections] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fullOriginalUrl = resolveImageUrl(originalUrl);
  const fullEnhancedUrl = resolveImageUrl(enhancedUrl);
  const fullAnnotatedUrl = annotatedUrl ? resolveImageUrl(annotatedUrl) : null;
  const displayEnhancedUrl = (showDetections && fullAnnotatedUrl) ? fullAnnotatedUrl : fullEnhancedUrl;

  const handleSliderMove = useCallback(
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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 3.5));
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
    setSliderPosition(50);
  };

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // If zoomed and holding space or middle click or secondary drag, pan
    if (zoom > 1 && (e.button === 1 || e.shiftKey || e.altKey)) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }
    setIsDraggingSlider(true);
    handleSliderMove(e.clientX);
  };

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDraggingSlider(true);
      handleSliderMove(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingSlider(false);
      setIsPanning(false);
    };
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingSlider) {
        handleSliderMove(e.clientX);
      } else if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      }
    };
    const handleTouchMove = (e: globalThis.TouchEvent) => {
      if (isDraggingSlider && e.touches[0]) {
        handleSliderMove(e.touches[0].clientX);
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
  }, [isDraggingSlider, isPanning, handleSliderMove]);

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
          {zoom > 1 && (
            <span className="rounded bg-cyan-950/70 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
              {zoom}x Zoom
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 3.5}
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

          {/* Biological Detection HUD Toggle (Milestone B) */}
          <button
            onClick={() => setShowDetections(!showDetections)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              showDetections
                ? "bg-cyan-500 text-zinc-950 font-semibold shadow-md shadow-cyan-500/20"
                : "bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-900 hover:text-white"
            }`}
            title="Toggle Marine Biological & Coral Detection Overlay (Phase 2)"
          >
            {showDetections ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <Fish className="h-3.5 w-3.5 text-cyan-400" />
            )}
            <span className="hidden sm:inline">Biological Overlay</span>
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

          {/* PDF Report button */}
          {resultId && (
            <button
              onClick={async () => {
                setIsExportingPdf(true);
                try {
                  await downloadReportPdf(resultId);
                } catch (e) {
                  console.error(e);
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 hover:text-cyan-200 active:scale-95 transition-all disabled:opacity-50"
              title="Download Formal Engineering Inspection Report PDF"
            >
              {isExportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-cyan-400" />
              )}
              <span>PDF Report</span>
            </button>
          )}

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
            <div
              className="relative h-full w-full transition-transform duration-75"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: "center center",
              }}
            >
              {/* Enhanced Image (Background layer) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayEnhancedUrl}
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
                    width: containerWidth > 0 ? `${containerWidth}px` : "100%",
                  }}
                />
              </div>
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
              {showDetections ? "Enhanced + Biological HUD" : "Enhanced (AquaVision)"}
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
                className="max-h-[440px] w-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
              />
            </div>

            <div className="relative flex flex-col items-center justify-center overflow-hidden rounded border border-zinc-800 bg-zinc-900/40 p-1">
              <span className="absolute top-2 left-2 z-10 rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-medium text-cyan-300 border border-cyan-800/50">
                {showDetections ? "Enhanced + Biological HUD" : "Enhanced (AquaVision)"}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayEnhancedUrl}
                alt="Enhanced Underwater"
                className="max-h-[440px] w-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-zinc-500">
        {zoom > 1
          ? "Shift+drag or pan to inspect high-frequency underwater textures"
          : "Drag slider or click horizontally to compare color restoration and detail preservation"}
      </p>
    </div>
  );
}
