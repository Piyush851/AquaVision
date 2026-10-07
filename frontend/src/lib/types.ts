export interface EnhancementMetrics {
  inference_mode: string;
  device: string;
  processing_time_seconds: number;
  estimated_psnr: number;
  input_path: string;
  output_path: string;
  original_dimensions: string;
}

export interface EnhancementResponse {
  id: string;
  filename: string;
  original_url: string;
  enhanced_url: string;
  metrics: EnhancementMetrics;
}

export interface HistoryRecord {
  id: string;
  enhanced_file: string;
  enhanced_url: string;
  original_url: string | null;
  created_at: number;
}

export interface SystemInfo {
  status: string;
  device: string;
  model_loaded: boolean;
  weights_path: string;
}
