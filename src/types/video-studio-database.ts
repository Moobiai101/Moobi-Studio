// Production-Grade Video Studio Database Types
// Matches the video_studio_* tables in Supabase

export interface VideoStudioProject {
  id: string;
  user_id: string;
  
  // Basic project info
  title: string;
  description?: string;
  thumbnail_url?: string;
  
  // Video specifications
  resolution_width: number;
  resolution_height: number;
  fps: number;
  aspect_ratio: string;
  duration_seconds: number;
  
  // Project status and metadata
  status: 'draft' | 'editing' | 'rendering' | 'completed' | 'archived';
  version: number;
  is_template: boolean;
  is_public: boolean;
  
  // Collaboration and sharing
  collaborators: string[]; // Array of user IDs
  share_token?: string;
  
  // Timeline state
  timeline_zoom: number;
  timeline_scroll: number;
  current_time: number;
  
  // Auto-save and backup
  auto_save_enabled: boolean;
  auto_save_interval: number;
  last_auto_save: string; // Now defaults to NOW() in database
  backup_count: number;
  
  // Export settings
  export_settings: {
    format: string;
    quality: string;
    resolution: { width: number; height: number };
    fps: number;
    bitrate: string;
  };
  
  // Performance tracking
  file_count: number;
  total_file_size: number;
  complexity_score: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  archived_at?: string;
}

export interface VideoStudioAsset {
  id: string;
  user_id: string;
  
  // File identification (for IndexedDB linking)
  fingerprint: string;
  secondary_fingerprint?: string;
  original_filename: string;
  file_path?: string;
  
  // File metadata
  content_type: string;
  file_size_bytes: number;
  duration_seconds?: number;
  
  // Media dimensions and specs
  width?: number;
  height?: number;
  aspect_ratio?: string;
  
  // Video-specific metadata
  video_codec?: string;
  audio_codec?: string;
  bitrate_kbps?: number;
  fps?: number;
  audio_channels: number;
  audio_sample_rate: number;
  
  // Processing status
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  proxy_status: 'pending' | 'processing' | 'completed' | 'failed';
  thumbnail_status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Analysis results
  scene_analysis?: {
    scenes: Array<{ start: number; end: number; type: string }>;
    cuts: number[];
    motion_levels: number[];
  };
  audio_analysis?: {
    volume_levels: number[];
    silence_segments: Array<{ start: number; end: number }>;
    peak_levels: number[];
  };
  color_analysis?: {
    dominant_colors: string[];
    brightness_avg: number;
    contrast_avg: number;
  };
  
  // Usage tracking
  usage_count: number;
  projects_used_in: string[];
  
  // Cache keys for IndexedDB
  thumbnail_cache_key?: string;
  filmstrip_cache_key?: string;
  proxy_cache_keys: Record<string, string>; // quality -> cache_key
  
  // Timestamps
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface VideoStudioTrack {
  id: string;
  project_id: string;
  
  // Track identification
  name: string;
  type: 'video' | 'audio' | 'overlay' | 'text' | 'subtitle';
  position: number;
  
  // Visual properties
  height: number;
  color: string;
  
  // Track settings
  volume: number;
  opacity: number;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  visible: boolean;
  
  // Advanced properties
  blend_mode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 
              'color-dodge' | 'color-burn' | 'darken' | 'lighten' | 'difference' | 'exclusion';
  
  // Audio-specific settings
  pan: number; // -1 to 1
  audio_effects: AudioEffect[];
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VideoStudioClip {
  id: string;
  project_id: string;
  track_id: string;
  asset_id?: string;
  
  // Timeline positioning (microsecond precision)
  start_time: number;
  end_time: number;
  layer_index: number;
  
  // Source trimming
  trim_start: number;
  trim_end?: number;
  
  // Transform properties
  position_x: number;
  position_y: number;
  scale_x: number;
  scale_y: number;
  rotation: number;
  anchor_x: number;
  anchor_y: number;
  
  // Visual properties
  opacity: number;
  blend_mode: string;
  
  // Audio properties
  volume: number;
  muted: boolean;
  playback_rate: number;
  
  // Text overlay properties
  text_content?: {
    text: string;
    style: {
      fontSize: number;
      fontFamily: string;
      color: string;
      backgroundColor?: string;
      alignment: 'left' | 'center' | 'right';
      fontWeight?: string;
      fontStyle?: string;
      textDecoration?: string;
      lineHeight?: number;
      letterSpacing?: number;
    };
    animation?: {
      type: string;
      duration: number;
      delay: number;
      easing: string;
      parameters: Record<string, any>;
    };
  };
  
  // Effect chains
  video_effects: VideoEffect[];
  audio_effects: AudioEffect[];
  
  // Motion blur and quality
  motion_blur_enabled: boolean;
  motion_blur_shutter_angle: number;
  quality_level: 'draft' | 'preview' | 'high' | 'maximum';
  
  // Metadata
  name?: string;
  notes?: string;
  tags: string[];
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VideoStudioKeyframe {
  id: string;
  clip_id: string;
  
  // Keyframe positioning
  time_offset: number;
  property_path: string; // e.g., 'position.x', 'scale.y', 'volume'
  
  // Keyframe value (flexible for any property type)
  value: any;
  
  // Interpolation settings
  interpolation_type: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier' | 'step';
  
  // Bezier curve control points
  bezier_control_1?: { x: number; y: number };
  bezier_control_2?: { x: number; y: number };
  
  // Keyframe metadata
  locked: boolean;
  selected: boolean;
  
  // Timestamps
  created_at: string;
}

export interface VideoStudioTransition {
  id: string;
  project_id: string;
  from_clip_id?: string;
  to_clip_id?: string;
  
  // Transition properties
  type: 'cut' | 'fade' | 'dissolve' | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down' |
        'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' |
        'zoom_in' | 'zoom_out' | 'blur' | 'pixelate' | 'custom';
  
  duration: number;
  
  // Timing and easing
  ease_in: number;
  ease_out: number;
  
  // Custom parameters
  parameters: Record<string, any>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VideoStudioEffect {
  id: string;
  user_id?: string;
  
  // Effect identification
  name: string;
  category: 'color' | 'blur' | 'distortion' | 'stylize' | 'noise' | 'sharpen' |
            'audio_filter' | 'audio_eq' | 'audio_dynamics' | 'transition' | 'generator';
  type: string;
  
  // Effect definition
  parameters_schema: Record<string, any>;
  default_parameters: Record<string, any>;
  
  // Metadata
  description?: string;
  thumbnail_url?: string;
  is_system_effect: boolean;
  is_premium: boolean;
  
  // Usage tracking
  usage_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface VideoStudioHistory {
  id: string;
  project_id: string;
  
  // Action details
  action_type: 'clip_add' | 'clip_remove' | 'clip_move' | 'clip_resize' | 'clip_split' |
               'track_add' | 'track_remove' | 'track_reorder' |
               'effect_add' | 'effect_remove' | 'effect_modify' |
               'keyframe_add' | 'keyframe_remove' | 'keyframe_modify' |
               'transition_add' | 'transition_remove' | 'transition_modify' |
               'project_settings' | 'bulk_operation';
  
  // Action data for undo/redo
  action_data: Record<string, any>;
  reverse_action_data?: Record<string, any>;
  
  // Context
  affected_objects: Record<string, any>;
  user_action: boolean;
  
  // Grouping
  operation_group_id?: string;
  
  // Timestamps
  created_at: string;
}

export interface VideoStudioCollaboration {
  id: string;
  project_id: string;
  user_id: string;
  
  // Session info
  session_id: string;
  is_active: boolean;
  
  // Permissions
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  can_edit: boolean;
  can_export: boolean;
  can_share: boolean;
  
  // Presence data
  cursor_position?: {
    timeline_time: number;
    selected_objects: string[];
    viewport: { zoom: number; scroll: number };
  };
  viewport_state?: {
    zoom: number;
    scroll: number;
    visible_tracks: string[];
  };
  
  // Timestamps
  joined_at: string;
  last_active_at: string;
}

// Effect type definitions
export interface VideoEffect {
  id: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, any>;
  blend_mode?: string;
  opacity?: number;
}

export interface AudioEffect {
  id: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, any>;
  wet_dry_mix?: number; // 0-1
}

// Utility types for complex operations
export interface TimelineData {
  project: VideoStudioProject;
  tracks: VideoStudioTrack[];
  clips: VideoStudioClip[];
  keyframes: VideoStudioKeyframe[];
  transitions: VideoStudioTransition[];
  assets: VideoStudioAsset[];
}

export interface ProjectOverview extends VideoStudioProject {
  track_count: number;
  clip_count: number;
  asset_count: number;
  total_size_bytes: number;
  actual_duration: number;
}

// Database response types (for Supabase queries)
export type VideoStudioProjectRow = VideoStudioProject;
export type VideoStudioAssetRow = VideoStudioAsset;
export type VideoStudioTrackRow = VideoStudioTrack;
export type VideoStudioClipRow = VideoStudioClip;
export type VideoStudioKeyframeRow = VideoStudioKeyframe;
export type VideoStudioTransitionRow = VideoStudioTransition;
export type VideoStudioEffectRow = VideoStudioEffect;
export type VideoStudioHistoryRow = VideoStudioHistory;
export type VideoStudioCollaborationRow = VideoStudioCollaboration;

// API request/response types
export interface CreateProjectRequest {
  title: string;
  description?: string;
  resolution_width?: number;
  resolution_height?: number;
  fps?: number;
  aspect_ratio?: string;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  timeline_zoom?: number;
  timeline_scroll?: number;
  current_time?: number;
  export_settings?: Partial<VideoStudioProject['export_settings']>;
}

export interface CreateAssetRequest {
  fingerprint: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  duration_seconds?: number;
  width?: number;
  height?: number;
  video_codec?: string;
  audio_codec?: string;
}

export interface CreateClipRequest {
  track_id: string;
  asset_id?: string;
  start_time: number;
  end_time: number;
  trim_start?: number;
  trim_end?: number;
  position_x?: number;
  position_y?: number;
  scale_x?: number;
  scale_y?: number;
  rotation?: number;
  volume?: number;
  text_content?: VideoStudioClip['text_content'];
}

export interface CreateKeyframeRequest {
  clip_id: string;
  time_offset: number;
  property_path: string;
  value: any;
  interpolation_type?: VideoStudioKeyframe['interpolation_type'];
}

// IndexedDB types for local storage
export interface IndexedDBAsset {
  fingerprint: string;
  blob_data: Blob;
  original_filename: string;
  file_size: number;
  content_type: string;
  duration?: number;
  created_at: string;
}

export interface IndexedDBThumbnail {
  asset_fingerprint: string;
  thumbnail_blob: Blob;
  width: number;
  height: number;
  created_at: string;
}

export interface IndexedDBFilmstrip {
  cache_key: string;
  asset_fingerprint: string;
  filmstrip_blob: Blob;
  frame_count: number;
  width: number;
  created_at: string;
}

export interface IndexedDBProxy {
  asset_fingerprint: string;
  proxy_blob: Blob;
  quality_level: 'low' | 'medium' | 'high';
  resolution: { width: number; height: number };
  created_at: string;
}

export interface IndexedDBProjectCache {
  project_id: string;
  cached_data: any;
  last_updated: string;
  size_bytes: number;
} 