export interface EnhancementMetrics {
  inference_mode: string;
  device: string;
  processing_time_seconds: number;
  estimated_psnr: number;
  uiqm?: number;
  uciqe?: number;
  input_path: string;
  output_path: string;
  original_dimensions: string;
  resolution_profile?: {
    tier: string;
    strategy: string;
    megapixels: number;
    description: string;
  };
  type?: string;
  stats?: {
    average_fps?: number;
    frames_processed?: number;
    total_frames?: number;
    elapsed_seconds?: number;
    side_by_side?: boolean;
  };
  [key: string]: unknown;
}

export interface MarineDetection {
  box: [number, number, number, number];
  normalized_box: [number, number, number, number];
  label: string;
  category: "fauna" | "coral" | "bleached" | "debris" | "diver" | "general";
  confidence: number;
  color_bgr?: [number, number, number];
}

export interface CoralHealthAssessment {
  coral_detected: boolean;
  coverage_pct: number;
  bleaching_index: number;
  health_status: string;
  health_color: string;
  healthy_coral_pct: number;
  bleached_coral_pct: number;
  algae_overgrowth_pct: number;
  recommendation: string;
}

export interface EnhancementResponse {
  id: string;
  filename: string;
  original_url: string;
  enhanced_url: string;
  annotated_url?: string | null;
  metrics: EnhancementMetrics;
  detections?: MarineDetection[] | null;
  coral_health?: CoralHealthAssessment | null;
}

export interface BatchProcessingResponse {
  total_submitted: number;
  total_processed: number;
  elapsed_seconds: number;
  average_fps: number;
  items: EnhancementResponse[];
}

export interface HistoryRecord {
  id: string;
  filename?: string;
  enhanced_file: string;
  enhanced_url: string;
  original_url: string | null;
  annotated_url?: string | null;
  created_at: number;
  metrics?: EnhancementMetrics | null;
  detections?: MarineDetection[] | null;
  coral_health?: CoralHealthAssessment | null;
}

export interface SystemInfo {
  status: string;
  device: string;
  model_loaded: boolean;
  weights_path: string;
}

export interface DomainMetricBreakdown {
  uiqm: number;
  uciqe: number;
  psnr: number;
  ssim: number;
  latency_ms: number;
}

export interface BenchmarkModelResult {
  id: string;
  name: string;
  dataset_trained: string;
  domain: string;
  is_dl: boolean;
  checkpoint: string | null;
  mean_uiqm: number;
  mean_uciqe: number;
  mean_psnr: number;
  mean_ssim: number;
  latency_ms: number;
  fps: number;
  params_million: number;
  domain_breakdown: Record<string, DomainMetricBreakdown>;
}

export interface BenchmarkPayload {
  timestamp: string;
  hardware_device: string;
  gpu_name: string;
  total_test_images: number;
  models: BenchmarkModelResult[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  total_enhancements: number;
  account_status: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
  expires_in_hours: number;
  user: User;
}

export interface GuestStatus {
  guest_id: string;
  used: number;
  max_allowed: number;
  remaining: number;
  is_quota_exhausted: boolean;
}

export interface UserHistoryRecord {
  id: string;
  filename: string;
  raw_url: string;
  enhanced_url: string;
  annotated_url?: string | null;
  model_name: string;
  inference_mode: string;
  uiqm?: number | null;
  uciqe?: number | null;
  psnr?: number | null;
  metrics?: EnhancementMetrics | null;
  detections?: MarineDetection[] | null;
  coral_health?: CoralHealthAssessment | null;
  created_at?: string | null;
}
