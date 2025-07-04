// Database types for Video Editor with WebAssembly Enhancement
export interface UserAsset {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  tags: string[];
  r2_object_key: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  dimensions?: { width: number; height: number };
  source_studio: string;
  source_prompt?: string;
  model_used?: string;
  source_generated_content_id?: string;
  generation_metadata?: any;
  created_at: string;
  updated_at: string;
  // Video-specific fields
  duration_seconds?: number;
  video_metadata?: {
    fps?: number;
    codec?: string;
    bitrate?: string;
    audio_channels?: number;
    audio_sample_rate?: number;
  };
  // NEW: WebAssembly processing metadata
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  processing_metadata?: {
    thumbnails_generated?: boolean;
    waveform_generated?: boolean;
    frames_extracted?: boolean;
    last_processed?: string;
    processing_errors?: string[];
    cache_keys?: {
      thumbnails?: string[];
      waveform?: string;
      preview_frames?: string[];
    };
  };
  // Performance optimization flags
  optimization_flags?: {
    needs_transcoding?: boolean;
    recommended_quality?: 'low' | 'medium' | 'high';
    webassembly_compatible?: boolean;
    estimated_processing_time?: number;
  };
}

export interface VideoTrack {
  id: string;
  type: 'video' | 'audio' | 'overlay';
  name: string;
  position: number;
  settings: {
    volume?: number;
    opacity?: number;
    locked?: boolean;
    visible?: boolean;
    blendMode?: string;
  };
  // NEW: WebAssembly processing settings
  processing_settings?: {
    use_webassembly?: boolean;
    quality_preset?: 'performance' | 'balanced' | 'quality';
    cache_frames?: boolean;
  };
}

export interface VideoClip {
  id: string;
  trackId: string;
  assetId?: string; // References user_assets.id
  startTime: number;
  endTime: number;
  trimStart?: number;
  trimEnd?: number;
  transform?: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
  effects?: Array<{
    type: string;
    parameters: Record<string, any>;
    // NEW: WebAssembly effect metadata
    webassembly_enabled?: boolean;
    processing_complexity?: 'low' | 'medium' | 'high';
  }>;
  // For text overlays
  textContent?: {
    text: string;
    style: {
      fontSize?: number;
      fontFamily?: string;
      color?: string;
      backgroundColor?: string;
      alignment?: 'left' | 'center' | 'right';
    };
  };
  // Audio settings
  volume?: number;
  playbackRate?: number;
  isMuted?: boolean;
  // NEW: Clip processing cache
  cache_metadata?: {
    thumbnail_cached?: boolean;
    frames_cached?: boolean;
    effects_processed?: boolean;
    last_cache_update?: string;
  };
}

export interface VideoTransition {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: 'cut' | 'fade' | 'dissolve' | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down' | 'slide' | 'zoom' | 'blur';
  duration: number;
  parameters: Record<string, any>;
  // NEW: WebAssembly transition processing
  webassembly_enabled?: boolean;
  precomputed_frames?: boolean;
}

// NEW: Export history tracking (no longer storing in R2)
export interface ExportHistory {
  id: string;
  project_id: string;
  user_id: string;
  export_settings: {
    format: string;
    quality: string;
    resolution: { width: number; height: number };
    fps: number;
    bitrate?: string;
  };
  export_status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  processing_time_seconds?: number;
  file_size_bytes?: number;
  download_count: number;
  expires_at: string; // When the download link expires
  error_message?: string;
  webassembly_used: boolean;
  performance_metrics?: {
    encoding_time: number;
    memory_usage_mb: number;
    cpu_utilization: number;
    frames_processed: number;
  };
  created_at: string;
  completed_at?: string;
}

// Enhanced project data structure
export interface ProjectData {
  tracks: VideoTrack[];
  clips: VideoClip[];
  transitions: VideoTransition[];
  effects: any[];
  timeline: {
    zoom: number;
    scroll: number;
    currentTime: number;
  };
  // NEW: WebAssembly project settings
  webassembly_settings?: {
    enabled: boolean;
    processing_quality: 'low' | 'medium' | 'high';
    use_simd: boolean;
    worker_threads: number;
    memory_limit_mb: number;
    cache_strategy: 'aggressive' | 'balanced' | 'minimal';
  };
  // Performance tracking
  performance_data?: {
    last_render_time?: number;
    average_fps?: number;
    memory_usage?: number;
    cache_hit_rate?: number;
  };
}

export interface VideoEditorProject {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  thumbnail_asset_id?: string;
  resolution: { width: number; height: number };
  fps: number;
  duration_seconds: number;
  aspect_ratio: string;
  project_data: ProjectData;
  status: 'draft' | 'processing' | 'completed' | 'failed' | 'rendering';
  is_public: boolean;
  render_progress: number;
  version: number;
  auto_save_data?: ProjectData;
  last_auto_save?: string;
  export_settings: {
    format: string;
    quality: string;
    resolution: { width: number; height: number };
  };
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  // NEW: Enhanced project metadata
  project_metadata?: {
    total_assets: number;
    processing_status: 'ready' | 'processing' | 'needs_processing';
    webassembly_compatible: boolean;
    estimated_render_time?: number;
    cache_status: {
      thumbnails_cached: number;
      waveforms_cached: number;
      frames_cached: number;
    };
    collaboration?: {
      shared_with: string[];
      last_collaborator?: string;
      sync_status: 'synced' | 'syncing' | 'conflict';
    };
  };
  // NEW: Performance optimization
  optimization_data?: {
    complexity_score: number; // 1-10 scale
    recommended_settings: {
      webassembly_enabled: boolean;
      quality_preset: string;
      worker_count: number;
    };
    bottlenecks?: string[];
  };
}

// NEW: WebAssembly processing jobs queue
export interface ProcessingJob {
  id: string;
  user_id: string;
  project_id?: string;
  asset_id?: string;
  job_type: 'thumbnail_generation' | 'waveform_extraction' | 'frame_extraction' | 'effect_processing' | 'export';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number; // 1-10, higher is more urgent
  job_data: any; // Specific data for the job type
  progress_percentage: number;
  estimated_completion?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  worker_id?: string;
  processing_metrics?: {
    cpu_time_ms: number;
    memory_peak_mb: number;
    webassembly_used: boolean;
  };
  created_at: string;
}

// NEW: Device capabilities for adaptive performance
export interface DeviceCapabilities {
  user_id: string;
  device_id: string;
  capabilities: {
    webassembly_supported: boolean;
    simd_supported: boolean;
    memory_gb: number;
    cpu_cores: number;
    gpu_acceleration: boolean;
    max_video_resolution: string;
    supported_codecs: string[];
  };
  performance_profile: {
    benchmark_score: number;
    recommended_quality: 'low' | 'medium' | 'high';
    max_concurrent_jobs: number;
    cache_size_mb: number;
  };
  browser_info: {
    name: string;
    version: string;
    features_supported: string[];
  };
  last_updated: string;
  created_at: string;
}

// Supabase response types
export type VideoProjectRow = VideoEditorProject;
export type UserAssetRow = UserAsset; 
export type ExportHistoryRow = ExportHistory;
export type ProcessingJobRow = ProcessingJob;
export type DeviceCapabilitiesRow = DeviceCapabilities; 