import { EnhancementResponse, HistoryRecord, SystemInfo } from "./types";

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
