import {
  EnhancementResponse,
  HistoryRecord,
  SystemInfo,
  BenchmarkPayload,
  MarineDetection,
  CoralHealthAssessment,
  BatchProcessingResponse
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export function resolveImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE_URL}/health`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/info`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch system info: ${res.status}`);
  }
  return res.json();
}

export async function getHistory(): Promise<HistoryRecord[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/history`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch history: ${res.status}`);
  }
  return res.json();
}

export async function uploadAndEnhance(
  file: File,
  forceClassical: boolean = false
): Promise<EnhancementResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE_URL}/api/v1/enhance/upload?force_classical=${forceClassical}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = "Enhancement failed";
    try {
      const errorJson = await res.json();
      if (errorJson.detail) errorDetail = errorJson.detail;
    } catch {
      errorDetail = `Server responded with ${res.status}`;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export async function loadSampleAsFile(
  samplePath: string,
  filename: string
): Promise<File> {
  const response = await fetch(samplePath);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

export async function downloadReportPdf(fileId: string): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/enhance/report/${fileId}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to generate inspection report: ${res.status}`);
  }
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `AquaVision_Inspection_${fileId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

export async function listAvailableModels(): Promise<{
  active_weights: string;
  active_model_name: string;
  available_checkpoints: Array<{
    filename: string;
    path: string;
    size_mb: number;
    is_active: boolean;
  }>;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/models`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status}`);
  }
  return res.json();
}

export async function switchModel(modelName: string): Promise<{
  success: boolean;
  active_model: string;
  device: string;
  mode: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/switch-model`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: modelName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to switch model: ${res.status}`);
  }
  return res.json();
}

export async function enhanceVideo(
  file: File,
  sideBySide: boolean = true,
  maxFrames: number = 300
): Promise<{
  id: string;
  filename: string;
  enhanced_video_url: string;
  raw_video_url: string;
  stats: Record<string, unknown>;
}> {
  const formData = new FormData();
  formData.append("file", file);
  const url = `${API_BASE_URL}/api/v1/enhance/video?side_by_side=${sideBySide}&max_frames=${maxFrames}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Video enhancement failed (${res.status})`);
  }
  return res.json();
}

export async function fetchBenchmarkResults(recalculate: boolean = false): Promise<BenchmarkPayload> {
  const url = `${API_BASE_URL}/api/v1/enhance/benchmark?recalculate=${recalculate}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch benchmark results: ${res.status}`);
  }
  return res.json();
}

export async function downloadBenchmarkCSV(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/benchmark/export/csv`);
  if (!res.ok) throw new Error("Failed to download benchmark CSV");
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = "AquaVision_Benchmark_Metrology.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

export async function getBenchmarkLatex(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/benchmark/export/latex`);
  if (!res.ok) throw new Error("Failed to fetch benchmark LaTeX");
  const data = await res.json();
  return data.latex;
}

export async function runMarineDetection(fileId: string): Promise<{
  id: string;
  annotated_url: string;
  detections: MarineDetection[];
  coral_health: CoralHealthAssessment;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/enhance/detect/${fileId}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Marine biological detection failed: ${res.status}`);
  }
  return res.json();
}

export async function uploadBatchAndEnhance(
  files: File[],
  forceClassical: boolean = false,
  detectMarine: boolean = true
): Promise<BatchProcessingResponse> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const url = `${API_BASE_URL}/api/v1/enhance/batch?force_classical=${forceClassical}&detect_marine=${detectMarine}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.detail || `Batch processing failed (${res.status})`);
  }

  return res.json();
}

export async function downloadBatchZip(fileIds?: string[]): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/enhance/batch/zip`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds && fileIds.length > 0 ? fileIds : null }),
  });

  if (!res.ok) {
    throw new Error(`Failed to download batch ZIP archive: ${res.status}`);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `AquaVision_Batch_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

export async function downloadBatchSurveyPdf(
  fileIds?: string[],
  missionTitle: string = "Subsea Inspection Survey Mission"
): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/enhance/batch/report?mission_title=${encodeURIComponent(missionTitle)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds && fileIds.length > 0 ? fileIds : null }),
  });

  if (!res.ok) {
    throw new Error(`Failed to generate batch survey PDF: ${res.status}`);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `AquaVision_Batch_Survey_${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}
