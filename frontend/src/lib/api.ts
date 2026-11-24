import {
  EnhancementResponse,
  HistoryRecord,
  SystemInfo,
  BenchmarkPayload,
  MarineDetection,
  CoralHealthAssessment,
  BatchProcessingResponse,
  User,
  AuthResponse,
  GuestStatus,
  UserHistoryRecord,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Local Token & Guest Session Management (24-Hour Active Windows)
// ---------------------------------------------------------------------------

export function getGuestId(): string {
  if (typeof window === "undefined") return "server_guest";
  let gid = localStorage.getItem("aquavision_guest_id");
  if (!gid) {
    gid = "guest_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem("aquavision_guest_id", gid);
  }
  return gid;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aquavision_auth_token");
}

export function setAuthSession(token: string, user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("aquavision_auth_token", token);
  localStorage.setItem("aquavision_user", JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("aquavision_auth_token");
  localStorage.removeItem("aquavision_user");
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("aquavision_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

  const headers: Record<string, string> = {
    "X-Guest-ID": getGuestId(),
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}/api/v1/enhance/upload?force_classical=${forceClassical}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
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

// ---------------------------------------------------------------------------
// Authentication & Profile Services
// ---------------------------------------------------------------------------

export async function signupUser(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    let msg = "Sign up failed";
    try {
      const data = await res.json();
      if (data.detail) msg = data.detail;
    } catch {
      msg = `Server returned ${res.status}`;
    }
    throw new Error(msg);
  }

  const authData: AuthResponse = await res.json();
  setAuthSession(authData.token, authData.user);
  return authData;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let msg = "Sign in failed";
    try {
      const data = await res.json();
      if (data.detail) msg = data.detail;
    } catch {
      msg = `Server returned ${res.status}`;
    }
    throw new Error(msg);
  }

  const authData: AuthResponse = await res.json();
  setAuthSession(authData.token, authData.user);
  return authData;
}

export async function logoutUser(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best-effort logout notification to server
    }
  }
  clearAuthSession();
}

export async function getCurrentUserProfile(): Promise<User | null> {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401) {
        clearAuthSession();
        return null;
      }
      return getStoredUser();
    }
    const user: User = await res.json();
    setAuthSession(token, user);
    return user;
  } catch {
    return getStoredUser();
  }
}

export async function getGuestStatus(): Promise<GuestStatus> {
  const headers: Record<string, string> = {
    "X-Guest-ID": getGuestId(),
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/guest-status`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    return {
      guest_id: getGuestId(),
      used: 0,
      max_allowed: 5,
      remaining: 5,
      is_quota_exhausted: false,
    };
  }

  return res.json();
}

export async function getUserHistory(): Promise<UserHistoryRecord[]> {
  const token = getAuthToken();
  if (!token) return [];

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user enhancement history: ${res.status}`);
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

export interface VideoEnhancementStats {
  average_fps: number;
  frames_processed: number;
  total_frames: number;
  elapsed_seconds: number;
  side_by_side: boolean;
}

export interface VideoEnhancementResult {
  id: string;
  filename: string;
  enhanced_video_url: string;
  raw_video_url: string;
  stats: VideoEnhancementStats;
}

export async function enhanceVideo(
  file: File,
  sideBySide: boolean = true,
  maxFrames: number = 300
): Promise<VideoEnhancementResult> {
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
