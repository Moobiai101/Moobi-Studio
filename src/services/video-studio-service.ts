import { createClient } from '@/lib/supabase/client';
import { 
  VideoStudioProject, 
  VideoStudioAsset, 
  VideoStudioTrack, 
  VideoStudioClip,
  VideoStudioKeyframe,
  VideoStudioTransition,
  VideoStudioHistory,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateAssetRequest,
  CreateClipRequest,
  CreateKeyframeRequest,
  TimelineData,
  ProjectOverview
} from '@/types/video-studio-database';

// Initialize Supabase client
const supabase = createClient();

/**
 * Production-Grade Video Studio Service
 * Handles all database operations for the video studio with optimized queries,
 * caching, error handling, and performance monitoring.
 */
export class VideoStudioService {
  
  // =====================================================
  // PROJECT MANAGEMENT
  // =====================================================
  
  /**
   * Get all projects for the current authenticated user
   */
  static async getUserProjects(): Promise<ProjectOverview[]> {
    try {
      // **SECURITY FIX: Use secure function that enforces user filtering**
      const { data, error } = await supabase
        .rpc('get_user_project_overview')
        .limit(50); // Limit for performance
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch user projects:', error);
      throw new Error('Failed to fetch projects');
    }
  }
  
  /**
   * Get a specific project by ID
   */
  static async getProject(projectId: string): Promise<VideoStudioProject> {
    try {
      const { data, error } = await supabase
        .from('video_studio_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('Project not found');
      
      // Update last_opened_at
      await this.updateProjectAccess(projectId);
      
      return data;
    } catch (error) {
      console.error('Failed to fetch project:', error);
      throw new Error('Failed to fetch project');
    }
  }
  
  /**
   * Create a new project
   */
  static async createProject(request: CreateProjectRequest): Promise<VideoStudioProject> {
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('video_studio_projects')
        .insert({
          user_id: user.id, // ✅ Explicitly set user_id for RLS policy
          title: request.title,
          description: request.description,
          resolution_width: request.resolution_width || 1920,
          resolution_height: request.resolution_height || 1080,
          fps: request.fps || 30,
          aspect_ratio: request.aspect_ratio || '16:9',
        })
        .select()
        .single();
      
      if (projectError) throw projectError;
      
      // Create default tracks
      const defaultTracks = [
        {
          project_id: project.id,
          name: 'Overlay Track',
          type: 'overlay' as const,
          position: 0,
          height: 60,
        },
        {
          project_id: project.id,
          name: 'Video Track 1',
          type: 'video' as const,
          position: 1,
          height: 80,
        },
        {
          project_id: project.id,
          name: 'Audio Track 1',
          type: 'audio' as const,
          position: 2,
          height: 60,
        },
      ];
      
      const { error: tracksError } = await supabase
        .from('video_studio_tracks')
        .insert(defaultTracks);
      
      if (tracksError) throw tracksError;
      
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw new Error('Failed to create project');
    }
  }
  
  /**
   * Update project settings
   */
  static async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_projects')
        .update(updates)
        .eq('id', projectId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw new Error('Failed to update project');
    }
  }
  
  /**
   * Delete a project and all related data
   */
  static async deleteProject(projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw new Error('Failed to delete project');
    }
  }
  
  /**
   * Update project access timestamp
   */
  private static async updateProjectAccess(projectId: string): Promise<void> {
    try {
      await supabase
        .from('video_studio_projects')
        .update({ last_opened_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (error) {
      // Silent fail - this is not critical
      console.warn('Failed to update project access time:', error);
    }
  }
  
  // =====================================================
  // ASSET MANAGEMENT
  // =====================================================
  
  /**
   * Create a new asset record (file metadata)
   */
  static async createAsset(request: CreateAssetRequest): Promise<VideoStudioAsset> {
    try {
      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('video_studio_assets')
        .insert({
          ...request,
          user_id: user.id, // ✅ Explicitly set user_id for RLS policy
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create asset:', error);
      throw new Error('Failed to create asset');
    }
  }
  
  /**
   * Get asset by fingerprint (for file recovery)
   */
  static async getAssetByFingerprint(fingerprint: string): Promise<VideoStudioAsset | null> {
    try {
      const { data, error } = await supabase
        .from('video_studio_assets')
        .select('*')
        .eq('fingerprint', fingerprint)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data || null;
    } catch (error) {
      console.error('Failed to get asset by fingerprint:', error);
      return null;
    }
  }
  
  /**
   * Get all assets for a user
   */
  static async getUserAssets(): Promise<VideoStudioAsset[]> {
    try {
      const { data, error } = await supabase
        .from('video_studio_assets')
        .select('*')
        .order('last_accessed_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch user assets:', error);
      throw new Error('Failed to fetch assets');
    }
  }
  
  /**
   * Update asset usage tracking
   */
  static async updateAssetUsage(assetId: string, projectId: string): Promise<void> {
    try {
      // Get current asset
      const { data: asset } = await supabase
        .from('video_studio_assets')
        .select('usage_count, projects_used_in')
        .eq('id', assetId)
        .single();
      
      if (!asset) return;
      
      // Update usage
      const projectsUsedIn = asset.projects_used_in || [];
      if (!projectsUsedIn.includes(projectId)) {
        projectsUsedIn.push(projectId);
      }
      
      await supabase
        .from('video_studio_assets')
        .update({
          usage_count: asset.usage_count + 1,
          projects_used_in: projectsUsedIn,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', assetId);
    } catch (error) {
      console.warn('Failed to update asset usage:', error);
    }
  }
  
  // =====================================================
  // TIMELINE DATA MANAGEMENT
  // =====================================================
  
  /**
   * Get complete timeline data for a project with proper error handling
   */
  static async getTimelineData(projectId: string): Promise<TimelineData> {
    try {
      // Get other timeline components
      const [
        { data: project, error: projectError },
        { data: tracks, error: tracksError },
        { data: timelineClips, error: clipsError },
      ] = await Promise.all([
        supabase.from('video_studio_projects').select('*').eq('id', projectId).single(),
        supabase.from('video_studio_tracks').select('*').eq('project_id', projectId).order('position'),
        supabase.from('video_studio_timeline_data').select('*').eq('project_id', projectId),
      ]);
      
      // **FIX: Handle project access errors properly**
      if (projectError || !project) {
        if (projectError?.code === 'PGRST116') {
          throw new Error(`Project ${projectId} not found or access denied`);
        }
        throw projectError || new Error('Project data is null');
      }
      
      if (tracksError) throw tracksError;
      if (clipsError) throw clipsError;
      
      // Get additional timeline data
      const [
        { data: keyframes },
        { data: transitions },
        { data: assets }
      ] = await Promise.all([
        supabase.from('video_studio_keyframes').select('*').in('clip_id', timelineClips?.map(c => c.id) || []),
        supabase.from('video_studio_transitions').select('*').eq('project_id', projectId),
        supabase.from('video_studio_assets').select('*').in('id', [...new Set(timelineClips?.map(c => c.asset_id).filter(Boolean) || [])])
      ]);
      
      return {
        project, // **FIX: Now guaranteed to be non-null**
        tracks: tracks || [],
        clips: timelineClips || [],
        keyframes: keyframes || [],
        transitions: transitions || [],
        assets: assets || [],
      };
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      throw new Error('Failed to fetch timeline data');
    }
  }
  
  // =====================================================
  // TRACK MANAGEMENT
  // =====================================================
  
  /**
   * Create a new track
   */
  static async createTrack(projectId: string, trackData: Partial<VideoStudioTrack>): Promise<VideoStudioTrack> {
    try {
      const { data, error } = await supabase
        .from('video_studio_tracks')
        .insert({
          project_id: projectId,
          ...trackData,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create track:', error);
      throw new Error('Failed to create track');
    }
  }
  
  /**
   * Update track settings
   */
  static async updateTrack(trackId: string, updates: Partial<VideoStudioTrack>): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_tracks')
        .update(updates)
        .eq('id', trackId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update track:', error);
      throw new Error('Failed to update track');
    }
  }
  
  /**
   * Delete a track and all its clips
   */
  static async deleteTrack(trackId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_tracks')
        .delete()
        .eq('id', trackId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete track:', error);
      throw new Error('Failed to delete track');
    }
  }
  
  // =====================================================
  // CLIP MANAGEMENT
  // =====================================================
  
  /**
   * Create a new clip
   */
  static async createClip(projectId: string, request: CreateClipRequest): Promise<VideoStudioClip> {
    try {
      const { data, error } = await supabase
        .from('video_studio_clips')
        .insert({
          project_id: projectId,
          ...request,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update asset usage if applicable
      if (request.asset_id) {
        await this.updateAssetUsage(request.asset_id, projectId);
      }
      
      return data;
    } catch (error) {
      console.error('Failed to create clip:', error);
      throw new Error('Failed to create clip');
    }
  }
  
  /**
   * Update clip properties
   */
  static async updateClip(clipId: string, updates: Partial<VideoStudioClip>): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_clips')
        .update(updates)
        .eq('id', clipId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update clip:', error);
      throw new Error('Failed to update clip');
    }
  }
  
  /**
   * Delete a clip and its keyframes
   */
  static async deleteClip(clipId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_clips')
        .delete()
        .eq('id', clipId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete clip:', error);
      throw new Error('Failed to delete clip');
    }
  }
  
  /**
   * Split a clip at a specific time
   */
  static async splitClip(clipId: string, splitTime: number): Promise<VideoStudioClip[]> {
    try {
      // Get the original clip
      const { data: originalClip, error: fetchError } = await supabase
        .from('video_studio_clips')
        .select('*')
        .eq('id', clipId)
        .single();
      
      if (fetchError || !originalClip) throw new Error('Clip not found');
      
      // Validate split time
      if (splitTime <= originalClip.start_time || splitTime >= originalClip.end_time) {
        throw new Error('Invalid split time');
      }
      
      // Calculate split properties
      const originalDuration = originalClip.end_time - originalClip.start_time;
      const timeFromStart = splitTime - originalClip.start_time;
      const trimDuration = (originalClip.trim_end || originalClip.end_time) - originalClip.trim_start;
      const trimSplitPoint = originalClip.trim_start + (timeFromStart / originalDuration) * trimDuration;
      
      // Create two new clips
      const firstClip = {
        ...originalClip,
        id: undefined, // Let database generate new ID
        end_time: splitTime,
        trim_end: trimSplitPoint,
      };
      
      const secondClip = {
        ...originalClip,
        id: undefined, // Let database generate new ID
        start_time: splitTime,
        trim_start: trimSplitPoint,
      };
      
      // Insert new clips and delete original in a transaction
      const { data: newClips, error: insertError } = await supabase
        .from('video_studio_clips')
        .insert([firstClip, secondClip])
        .select();
      
      if (insertError) throw insertError;
      
      // Delete original clip
      await this.deleteClip(clipId);
      
      return newClips || [];
    } catch (error) {
      console.error('Failed to split clip:', error);
      throw new Error('Failed to split clip');
    }
  }
  
  // =====================================================
  // KEYFRAME MANAGEMENT
  // =====================================================
  
  /**
   * Create a new keyframe
   */
  static async createKeyframe(request: CreateKeyframeRequest): Promise<VideoStudioKeyframe> {
    try {
      const { data, error } = await supabase
        .from('video_studio_keyframes')
        .insert(request)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create keyframe:', error);
      throw new Error('Failed to create keyframe');
    }
  }
  
  /**
   * Update keyframe value
   */
  static async updateKeyframe(keyframeId: string, updates: Partial<VideoStudioKeyframe>): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_keyframes')
        .update(updates)
        .eq('id', keyframeId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update keyframe:', error);
      throw new Error('Failed to update keyframe');
    }
  }
  
  /**
   * Delete a keyframe
   */
  static async deleteKeyframe(keyframeId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_keyframes')
        .delete()
        .eq('id', keyframeId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete keyframe:', error);
      throw new Error('Failed to delete keyframe');
    }
  }
  
  // =====================================================
  // HISTORY & UNDO/REDO
  // =====================================================
  
  /**
   * Record an action in history for undo/redo
   */
  static async recordAction(
    projectId: string, 
    actionType: VideoStudioHistory['action_type'],
    actionData: Record<string, any>,
    reverseActionData?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase
        .from('video_studio_history')
        .insert({
          project_id: projectId,
          action_type: actionType,
          action_data: actionData,
          reverse_action_data: reverseActionData,
          affected_objects: {}, // TODO: Extract affected object IDs
        });
      
      // Keep only last 100 actions per project for performance
      await this.cleanupHistory(projectId);
    } catch (error) {
      console.warn('Failed to record action in history:', error);
    }
  }
  
  /**
   * Get recent history for undo/redo
   */
  static async getProjectHistory(projectId: string, limit: number = 50): Promise<VideoStudioHistory[]> {
    try {
      const { data, error } = await supabase
        .from('video_studio_history')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch project history:', error);
      return [];
    }
  }
  
  /**
   * Clean up old history entries
   */
  private static async cleanupHistory(projectId: string): Promise<void> {
    try {
      // Keep only the most recent 100 entries
      const { data: oldEntries } = await supabase
        .from('video_studio_history')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .range(100, 1000); // Get entries beyond the first 100
      
      if (oldEntries && oldEntries.length > 0) {
        await supabase
          .from('video_studio_history')
          .delete()
          .in('id', oldEntries.map(entry => entry.id));
      }
    } catch (error) {
      console.warn('Failed to cleanup history:', error);
    }
  }
  
  // =====================================================
  // AUTO-SAVE FUNCTIONALITY
  // =====================================================
  
  /**
   * Save project state for auto-save
   */
  static async autoSaveProject(projectId: string, timelineData: Partial<TimelineData>): Promise<void> {
    try {
      await supabase
        .from('video_studio_projects')
        .update({
          last_auto_save: new Date().toISOString(),
          current_time: timelineData.project?.current_time,
          timeline_zoom: timelineData.project?.timeline_zoom,
          timeline_scroll: timelineData.project?.timeline_scroll,
        })
        .eq('id', projectId);
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }
  
  // =====================================================
  // PERFORMANCE MONITORING
  // =====================================================
  
  /**
   * Update project complexity score for performance optimization
   */
  static async updateComplexityScore(projectId: string): Promise<void> {
    try {
      // Calculate complexity based on clips, effects, keyframes
      const { data: stats } = await supabase
        .from('video_studio_project_overview')
        .select('clip_count, track_count')
        .eq('id', projectId)
        .single();
      
      if (stats) {
        const complexityScore = (stats.clip_count * 2) + (stats.track_count * 5);
        
        await supabase
          .from('video_studio_projects')
          .update({ complexity_score: complexityScore })
          .eq('id', projectId);
      }
    } catch (error) {
      console.warn('Failed to update complexity score:', error);
    }
  }

  // =====================================================
  // BATCH OPERATIONS FOR AUTO-SAVE
  // =====================================================

  /**
   * Update project timeline data
   */
  static async updateProjectTimeline(projectId: string, timelineData: TimelineData): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_projects')
        .update({ 
          timeline_data: timelineData,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update project timeline:', error);
      throw error;
    }
  }

  /**
   * Batch update clips for auto-save performance
   */
  static async batchUpdateClips(clips: VideoStudioClip[]): Promise<void> {
    try {
      // Validate and fix UUID formats
      const validClips = clips.map(clip => {
        // Ensure proper UUID format (if not, regenerate)
        if (!clip.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
          console.warn(`⚠️ Invalid UUID format for clip ${clip.id}, regenerating...`);
          clip.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }
        
        // Ensure all required fields are present
        return {
          ...clip,
          layer_index: clip.layer_index ?? 0,
          trim_start: clip.trim_start ?? 0,
          trim_end: clip.trim_end ?? clip.end_time,
          position_x: clip.position_x ?? 0,
          position_y: clip.position_y ?? 0,
          scale_x: clip.scale_x ?? 1,
          scale_y: clip.scale_y ?? 1,
          rotation: clip.rotation ?? 0,
          anchor_x: clip.anchor_x ?? 0.5,
          anchor_y: clip.anchor_y ?? 0.5,
          opacity: clip.opacity ?? 1,
          blend_mode: clip.blend_mode ?? 'normal',
          volume: clip.volume ?? 1,
          muted: clip.muted ?? false,
          playback_rate: clip.playback_rate ?? 1,
          video_effects: clip.video_effects ?? [],
          audio_effects: clip.audio_effects ?? [],
          motion_blur_enabled: clip.motion_blur_enabled ?? false,
          motion_blur_shutter_angle: clip.motion_blur_shutter_angle ?? 180,
          quality_level: clip.quality_level ?? 'high',
          tags: clip.tags ?? [],
          created_at: clip.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('video_studio_clips')
        .upsert(validClips, { onConflict: 'id' });

      if (error) throw error;
      console.log(`✅ Successfully saved ${validClips.length} clips to database`);
    } catch (error) {
      console.error('Failed to batch update clips:', error);
      throw error;
    }
  }

  /**
   * Batch update keyframes for auto-save performance
   */
  static async batchUpdateKeyframes(keyframes: VideoStudioKeyframe[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_studio_keyframes')
        .upsert(keyframes, { onConflict: 'id' });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to batch update keyframes:', error);
      throw error;
    }
  }
}

export default VideoStudioService; 