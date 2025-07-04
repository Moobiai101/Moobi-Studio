// Database types for Video Editor
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
  // New video-specific fields
  duration_seconds?: number;
  video_metadata?: {
    fps?: number;
    codec?: string;
    bitrate?: string;
    audio_channels?: number;
    audio_sample_rate?: number;
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
}

export interface VideoTransition {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: 'cut' | 'fade' | 'dissolve' | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down' | 'slide' | 'zoom' | 'blur';
  duration: number;
  parameters: Record<string, any>;
}

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
}

// Supabase response types
export type VideoProjectRow = VideoEditorProject;
export type UserAssetRow = UserAsset; 