export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]



export interface Database {
  public: {
    Tables: {
      // ============================================================================
      // USER MANAGEMENT & AUTHENTICATION
      // ============================================================================
      user_devices: {
        Row: {
          id: string
          user_id: string
          device_fingerprint: string
          device_name: string | null
          browser_info: Json
          last_active: string
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_fingerprint: string
          device_name?: string | null
          browser_info?: Json
          last_active?: string
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_fingerprint?: string
          device_name?: string | null
          browser_info?: Json
          last_active?: string
          is_primary?: boolean
          created_at?: string
        }
      }

      // ============================================================================
      // MEDIA ASSETS (Extended for Local-First)
      // ============================================================================
      user_assets: {
        Row: {
          id: string
          user_id: string
          title: string
          description?: string
          tags: string[]
          r2_object_key: string
          file_name: string
          content_type: string
          file_size_bytes: number
          source_studio: string
          duration_seconds?: number
          dimensions?: Json
          video_metadata?: Json
          created_at: string
          updated_at: string
          // New local-first fields
          local_asset_id?: string
          device_fingerprint?: string
          thumbnails_generated: boolean
          filmstrip_generated: boolean
          ai_generated: boolean
          ai_prompt?: string
          ai_model?: string
          ai_generation_data: Json
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string
          tags?: string[]
          r2_object_key: string
          file_name: string
          content_type: string
          file_size_bytes: number
          source_studio: string
          duration_seconds?: number
          dimensions?: Json
          video_metadata?: Json
          created_at?: string
          updated_at?: string
          local_asset_id?: string
          device_fingerprint?: string
          thumbnails_generated?: boolean
          filmstrip_generated?: boolean
          ai_generated?: boolean
          ai_prompt?: string
          ai_model?: string
          ai_generation_data?: Json
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          tags?: string[]
          r2_object_key?: string
          file_name?: string
          content_type?: string
          file_size_bytes?: number
          source_studio?: string
          duration_seconds?: number
          dimensions?: Json
          video_metadata?: Json
          created_at?: string
          updated_at?: string
          local_asset_id?: string
          device_fingerprint?: string
          thumbnails_generated?: boolean
          filmstrip_generated?: boolean
          ai_generated?: boolean
          ai_prompt?: string
          ai_model?: string
          ai_generation_data?: Json
        }
      }

      // ============================================================================
      // VIDEO PROJECTS (Restructured for Local-First)
      // ============================================================================
      video_editor_projects: {
        Row: {
          id: string
          user_id: string
          title: string
          description?: string
          duration_seconds: number
          fps: number
          resolution: Json
          export_settings: Json
          project_data: Json
          timeline_data: Json
          last_edited_device?: string
          tags: string[]
          is_template: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string
          duration_seconds?: number
          fps?: number
          resolution?: Json
          export_settings?: Json
          project_data?: Json
          timeline_data?: Json
          last_edited_device?: string
          tags?: string[]
          is_template?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          duration_seconds?: number
          fps?: number
          resolution?: Json
          export_settings?: Json
          project_data?: Json
          timeline_data?: Json
          last_edited_device?: string
          tags?: string[]
          is_template?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      // ============================================================================
      // TIMELINE STRUCTURE
      // ============================================================================
      timeline_tracks: {
        Row: {
          id: string
          project_id: string
          track_type: 'video' | 'audio' | 'overlay' | 'text'
          track_name: string
          track_order: number
          is_locked: boolean
          is_muted: boolean
          is_hidden: boolean
          volume: number
          opacity: number
          blend_mode: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          track_type: 'video' | 'audio' | 'overlay' | 'text'
          track_name: string
          track_order: number
          is_locked?: boolean
          is_muted?: boolean
          is_hidden?: boolean
          volume?: number
          opacity?: number
          blend_mode?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          track_type?: 'video' | 'audio' | 'overlay' | 'text'
          track_name?: string
          track_order?: number
          is_locked?: boolean
          is_muted?: boolean
          is_hidden?: boolean
          volume?: number
          opacity?: number
          blend_mode?: string
          created_at?: string
        }
      }

      timeline_clips: {
        Row: {
          id: string
          track_id: string
          asset_id: string
          start_time: number
          end_time: number
          layer_index: number
          trim_start: number
          trim_end?: number
          volume: number
          is_muted: boolean
          audio_fade_in: number
          audio_fade_out: number
          opacity: number
          transform_data: Json
          playback_speed: number
          reverse_playback: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          track_id: string
          asset_id: string
          start_time: number
          end_time: number
          layer_index?: number
          trim_start?: number
          trim_end?: number
          volume?: number
          is_muted?: boolean
          audio_fade_in?: number
          audio_fade_out?: number
          opacity?: number
          transform_data?: Json
          playback_speed?: number
          reverse_playback?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          track_id?: string
          asset_id?: string
          start_time?: number
          end_time?: number
          layer_index?: number
          trim_start?: number
          trim_end?: number
          volume?: number
          is_muted?: boolean
          audio_fade_in?: number
          audio_fade_out?: number
          opacity?: number
          transform_data?: Json
          playback_speed?: number
          reverse_playback?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      // ============================================================================
      // PROFESSIONAL EFFECTS SYSTEM
      // ============================================================================
      clip_transitions: {
        Row: {
          id: string
          from_clip_id: string
          to_clip_id: string
          transition_type: string
          duration: number
          easing_function: string
          direction?: string
          custom_properties: Json
          created_at: string
        }
        Insert: {
          id?: string
          from_clip_id: string
          to_clip_id: string
          transition_type: string
          duration: number
          easing_function?: string
          direction?: string
          custom_properties?: Json
          created_at?: string
        }
        Update: {
          id?: string
          from_clip_id?: string
          to_clip_id?: string
          transition_type?: string
          duration?: number
          easing_function?: string
          direction?: string
          custom_properties?: Json
          created_at?: string
        }
      }

      clip_effects: {
        Row: {
          id: string
          clip_id: string
          effect_type: string
          effect_name: string
          is_enabled: boolean
          effect_order: number
          parameters: Json
          keyframes: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          effect_type: string
          effect_name: string
          is_enabled?: boolean
          effect_order?: number
          parameters?: Json
          keyframes?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          effect_type?: string
          effect_name?: string
          is_enabled?: boolean
          effect_order?: number
          parameters?: Json
          keyframes?: Json
          created_at?: string
          updated_at?: string
        }
      }

      audio_effects: {
        Row: {
          id: string
          clip_id: string
          effect_type: string
          effect_name: string
          is_enabled: boolean
          effect_order: number
          parameters: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          effect_type: string
          effect_name: string
          is_enabled?: boolean
          effect_order?: number
          parameters?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          effect_type?: string
          effect_name?: string
          is_enabled?: boolean
          effect_order?: number
          parameters?: Json
          created_at?: string
          updated_at?: string
        }
      }

      text_elements: {
        Row: {
          id: string
          clip_id: string
          text_content: string
          font_family: string
          font_size: number
          font_weight: string
          font_style: string
          color: string
          background_color?: string
          border_color?: string
          border_width: number
          position: Json
          size: Json
          animation_in?: string
          animation_out?: string
          animation_duration?: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          text_content: string
          font_family?: string
          font_size?: number
          font_weight?: string
          font_style?: string
          color?: string
          background_color?: string
          border_color?: string
          border_width?: number
          position?: Json
          size?: Json
          animation_in?: string
          animation_out?: string
          animation_duration?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          text_content?: string
          font_family?: string
          font_size?: number
          font_weight?: string
          font_style?: string
          color?: string
          background_color?: string
          border_color?: string
          border_width?: number
          position?: Json
          size?: Json
          animation_in?: string
          animation_out?: string
          animation_duration?: number
          created_at?: string
          updated_at?: string
        }
      }

      keyframes: {
        Row: {
          id: string
          clip_id: string
          property_name: string
          time_offset: number
          value: Json
          easing_function: string
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          property_name: string
          time_offset: number
          value: Json
          easing_function?: string
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          property_name?: string
          time_offset?: number
          value?: Json
          easing_function?: string
          created_at?: string
        }
      }

      // ============================================================================
      // AI INTEGRATION
      // ============================================================================
      ai_generations: {
        Row: {
          id: string
          user_id: string
          project_id?: string
          generation_type: 'text_to_video' | 'image_to_video' | 'audio_generation' | 'text_generation'
          ai_model: string
          prompt: string
          negative_prompt?: string
          parameters: Json
          status: 'pending' | 'processing' | 'completed' | 'failed'
          progress: number
          generated_asset_id?: string
          generation_metadata: Json
          started_at: string
          completed_at?: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string
          generation_type: 'text_to_video' | 'image_to_video' | 'audio_generation' | 'text_generation'
          ai_model: string
          prompt: string
          negative_prompt?: string
          parameters?: Json
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress?: number
          generated_asset_id?: string
          generation_metadata?: Json
          started_at?: string
          completed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          generation_type?: 'text_to_video' | 'image_to_video' | 'audio_generation' | 'text_generation'
          ai_model?: string
          prompt?: string
          negative_prompt?: string
          parameters?: Json
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          progress?: number
          generated_asset_id?: string
          generation_metadata?: Json
          started_at?: string
          completed_at?: string
          created_at?: string
        }
      }

      // ============================================================================
      // PROJECT RECOVERY SYSTEM
      // ============================================================================
      project_recovery_points: {
        Row: {
          id: string
          project_id: string
          device_fingerprint: string
          project_state: Json
          asset_manifest: Json
          recovery_point_name?: string
          auto_generated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          device_fingerprint: string
          project_state: Json
          asset_manifest: Json
          recovery_point_name?: string
          auto_generated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          device_fingerprint?: string
          project_state?: Json
          asset_manifest?: Json
          recovery_point_name?: string
          auto_generated?: boolean
          created_at?: string
        }
      }

      asset_device_mapping: {
        Row: {
          id: string
          asset_id: string
          device_fingerprint: string
          is_available: boolean
          last_verified: string
          local_path?: string
          file_hash?: string
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          device_fingerprint: string
          is_available?: boolean
          last_verified?: string
          local_path?: string
          file_hash?: string
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          device_fingerprint?: string
          is_available?: boolean
          last_verified?: string
          local_path?: string
          file_hash?: string
          created_at?: string
        }
      }

      // ============================================================================
      // PROJECT EXPORTS
      // ============================================================================
      project_exports: {
        Row: {
          id: string
          project_id: string
          user_id: string
          export_format: string
          resolution: Json
          fps: number
          quality_preset: string
          status: 'queued' | 'processing' | 'completed' | 'failed'
          progress: number
          file_size_bytes?: number
          export_duration?: number
          started_at: string
          completed_at?: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          export_format: string
          resolution: Json
          fps: number
          quality_preset: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          progress?: number
          file_size_bytes?: number
          export_duration?: number
          started_at?: string
          completed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          export_format?: string
          resolution?: Json
          fps?: number
          quality_preset?: string
          status?: 'queued' | 'processing' | 'completed' | 'failed'
          progress?: number
          file_size_bytes?: number
          export_duration?: number
          started_at?: string
          completed_at?: string
          created_at?: string
        }
      }
    }
    Views: {
      project_timeline_view: {
        Row: {
          project_id: string
          project_title: string
          user_id: string
          duration_seconds: number
          fps: number
          resolution: Json
          tracks: Json
        }
      }
      ai_generation_status: {
        Row: {
          id: string
          user_id: string
          project_id?: string
          generation_type: string
          ai_model: string
          prompt: string
          status: string
          progress: number
          project_title?: string
          generated_filename?: string
          created_at: string
        }
      }
    }
    Functions: {
      calculate_project_duration: {
        Args: { p_project_id: string }
        Returns: number
      }
      create_default_tracks: {
        Args: { p_project_id: string }
        Returns: void
      }
      create_recovery_point: {
        Args: {
          p_project_id: string
          p_device_fingerprint: string
          p_auto_generated?: boolean
        }
        Returns: string
      }
    }
  }
}

// ============================================================================
// CONVENIENCE TYPES
// ============================================================================

export type UserAsset = Database['public']['Tables']['user_assets']['Row']
export type UserAssetInsert = Database['public']['Tables']['user_assets']['Insert']
export type UserAssetUpdate = Database['public']['Tables']['user_assets']['Update']

export type VideoEditorProject = Database['public']['Tables']['video_editor_projects']['Row']
export type VideoEditorProjectInsert = Database['public']['Tables']['video_editor_projects']['Insert']
export type VideoEditorProjectUpdate = Database['public']['Tables']['video_editor_projects']['Update']

export type TimelineTrack = Database['public']['Tables']['timeline_tracks']['Row']
export type TimelineTrackInsert = Database['public']['Tables']['timeline_tracks']['Insert']
export type TimelineTrackUpdate = Database['public']['Tables']['timeline_tracks']['Update']

export type TimelineClip = Database['public']['Tables']['timeline_clips']['Row']
export type TimelineClipInsert = Database['public']['Tables']['timeline_clips']['Insert']
export type TimelineClipUpdate = Database['public']['Tables']['timeline_clips']['Update']

export type ClipTransition = Database['public']['Tables']['clip_transitions']['Row']
export type ClipTransitionInsert = Database['public']['Tables']['clip_transitions']['Insert']
export type ClipTransitionUpdate = Database['public']['Tables']['clip_transitions']['Update']

export type ClipEffect = Database['public']['Tables']['clip_effects']['Row']
export type ClipEffectInsert = Database['public']['Tables']['clip_effects']['Insert']
export type ClipEffectUpdate = Database['public']['Tables']['clip_effects']['Update']

export type AudioEffect = Database['public']['Tables']['audio_effects']['Row']
export type AudioEffectInsert = Database['public']['Tables']['audio_effects']['Insert']
export type AudioEffectUpdate = Database['public']['Tables']['audio_effects']['Update']

export type TextElement = Database['public']['Tables']['text_elements']['Row']
export type TextElementInsert = Database['public']['Tables']['text_elements']['Insert']
export type TextElementUpdate = Database['public']['Tables']['text_elements']['Update']

export type Keyframe = Database['public']['Tables']['keyframes']['Row']
export type KeyframeInsert = Database['public']['Tables']['keyframes']['Insert']
export type KeyframeUpdate = Database['public']['Tables']['keyframes']['Update']

export type AIGeneration = Database['public']['Tables']['ai_generations']['Row']
export type AIGenerationInsert = Database['public']['Tables']['ai_generations']['Insert']
export type AIGenerationUpdate = Database['public']['Tables']['ai_generations']['Update']

export type UserDevice = Database['public']['Tables']['user_devices']['Row']
export type UserDeviceInsert = Database['public']['Tables']['user_devices']['Insert']
export type UserDeviceUpdate = Database['public']['Tables']['user_devices']['Update']

export type ProjectRecoveryPoint = Database['public']['Tables']['project_recovery_points']['Row']
export type ProjectRecoveryPointInsert = Database['public']['Tables']['project_recovery_points']['Insert']
export type ProjectRecoveryPointUpdate = Database['public']['Tables']['project_recovery_points']['Update']

export type AssetDeviceMapping = Database['public']['Tables']['asset_device_mapping']['Row']
export type AssetDeviceMappingInsert = Database['public']['Tables']['asset_device_mapping']['Insert']
export type AssetDeviceMappingUpdate = Database['public']['Tables']['asset_device_mapping']['Update']

export type ProjectExport = Database['public']['Tables']['project_exports']['Row']
export type ProjectExportInsert = Database['public']['Tables']['project_exports']['Insert']
export type ProjectExportUpdate = Database['public']['Tables']['project_exports']['Update']

// ============================================================================
// FRONTEND-SPECIFIC TYPES
// ============================================================================

export interface ProjectTimelineData {
  tracks: TimelineTrack[]
  clips: TimelineClip[]
  effects: ClipEffect[]
  audioEffects: AudioEffect[]
  textElements: TextElement[]
  transitions: ClipTransition[]
  keyframes: Keyframe[]
}

export interface MediaInfo {
  name: string
  type: 'video' | 'audio' | 'image'
  url: string
  duration?: number
  metadata?: {
    width?: number
    height?: number
    fps?: number
    size?: number
    [key: string]: any
  }
}

export interface TransformData {
  position: { x: number; y: number }
  scale: { x: number; y: number }
  rotation: number
  opacity: number
  anchorPoint?: { x: number; y: number }
  cropBox?: { x: number; y: number; width: number; height: number }
}

// Legacy compatibility types
export type VideoProjectRow = VideoEditorProject
export type UserAssetRow = UserAsset 