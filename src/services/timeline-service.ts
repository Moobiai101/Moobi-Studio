import { createClient } from '@/lib/supabase/client';
import {
  TimelineTrack,
  TimelineTrackInsert,
  TimelineTrackUpdate,
  TimelineClip,
  TimelineClipInsert,
  TimelineClipUpdate,
  VideoEditorProject,
  ClipEffect,
  ClipEffectInsert,
  AudioEffect,
  AudioEffectInsert,
  TextElement,
  TextElementInsert,
  ClipTransition,
  ClipTransitionInsert,
  Keyframe,
  KeyframeInsert
} from '@/types/database';
import { deviceFingerprint } from '@/lib/device/device-fingerprint';

export class TimelineService {
  private static supabase = createClient();

  // ============================================================================
  // TRACK MANAGEMENT
  // ============================================================================

  /**
   * Create default tracks for a new project
   */
  static async createDefaultTracks(projectId: string): Promise<TimelineTrack[]> {
    try {
      const defaultTracks: TimelineTrackInsert[] = [
        {
          project_id: projectId,
          track_type: 'video',
          track_name: 'Video Track 1',
          track_order: 1,
          volume: 1.0,
          opacity: 1.0,
          blend_mode: 'normal'
        },
        {
          project_id: projectId,
          track_type: 'audio',
          track_name: 'Audio Track 1',
          track_order: 2,
          volume: 1.0,
          opacity: 1.0,
          blend_mode: 'normal'
        },
        {
          project_id: projectId,
          track_type: 'overlay',
          track_name: 'Overlay Track 1',
          track_order: 3,
          volume: 1.0,
          opacity: 1.0,
          blend_mode: 'normal'
        }
      ];

      const { data: tracks, error } = await this.supabase
        .from('timeline_tracks')
        .insert(defaultTracks)
        .select();

      if (error) throw error;
      return tracks;
    } catch (error) {
      console.error('Error creating default tracks:', error);
      throw error;
    }
  }

  /**
   * Get all tracks for a project
   */
  static async getProjectTracks(projectId: string): Promise<TimelineTrack[]> {
    try {
      const { data: tracks, error } = await this.supabase
        .from('timeline_tracks')
        .select('*')
        .eq('project_id', projectId)
        .order('track_order', { ascending: true });

      if (error) throw error;
      return tracks || [];
    } catch (error) {
      console.error('Error getting project tracks:', error);
      return [];
    }
  }

  /**
   * Add a new track to project
   */
  static async addTrack(track: TimelineTrackInsert): Promise<TimelineTrack | null> {
    try {
      const { data, error } = await this.supabase
        .from('timeline_tracks')
        .insert(track)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding track:', error);
      return null;
    }
  }

  /**
   * Update track properties
   */
  static async updateTrack(trackId: string, updates: TimelineTrackUpdate): Promise<TimelineTrack | null> {
    try {
      const { data, error } = await this.supabase
        .from('timeline_tracks')
        .update(updates)
        .eq('id', trackId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating track:', error);
      return null;
    }
  }

  /**
   * Delete a track and all its clips
   */
  static async deleteTrack(trackId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('timeline_tracks')
        .delete()
        .eq('id', trackId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting track:', error);
      return false;
    }
  }

  // ============================================================================
  // CLIP MANAGEMENT
  // ============================================================================

  /**
   * Get all clips for a project
   */
  static async getProjectClips(projectId: string): Promise<TimelineClip[]> {
    try {
      const { data: clips, error } = await this.supabase
        .from('timeline_clips')
        .select(`
          *,
          timeline_tracks!inner (
            project_id
          )
        `)
        .eq('timeline_tracks.project_id', projectId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return clips || [];
    } catch (error) {
      console.error('Error getting project clips:', error);
      return [];
    }
  }

  /**
   * Get clips for a specific track
   */
  static async getTrackClips(trackId: string): Promise<TimelineClip[]> {
    try {
      const { data: clips, error } = await this.supabase
        .from('timeline_clips')
        .select('*')
        .eq('track_id', trackId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return clips || [];
    } catch (error) {
      console.error('Error getting track clips:', error);
      return [];
    }
  }

  /**
   * Add a new clip to timeline
   */
  static async addClip(clip: TimelineClipInsert): Promise<TimelineClip | null> {
    try {
      const { data, error } = await this.supabase
        .from('timeline_clips')
        .insert({
          ...clip,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding clip:', error);
      return null;
    }
  }

  /**
   * Update clip properties
   */
  static async updateClip(clipId: string, updates: TimelineClipUpdate): Promise<TimelineClip | null> {
    try {
      const { data, error } = await this.supabase
        .from('timeline_clips')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', clipId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating clip:', error);
      return null;
    }
  }

  /**
   * Delete a clip and all its related data
   */
  static async deleteClip(clipId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('timeline_clips')
        .delete()
        .eq('id', clipId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting clip:', error);
      return false;
    }
  }

  /**
   * Split a clip at a specific time
   */
  static async splitClip(clipId: string, splitTime: number): Promise<TimelineClip[] | null> {
    try {
      // Get the original clip
      const { data: originalClip, error: fetchError } = await this.supabase
        .from('timeline_clips')
        .select('*')
        .eq('id', clipId)
        .single();

      if (fetchError || !originalClip) throw fetchError;

      // Validate split time
      if (splitTime <= originalClip.start_time || splitTime >= originalClip.end_time) {
        throw new Error('Invalid split time');
      }

      // Calculate trim adjustments
      const originalDuration = originalClip.end_time - originalClip.start_time;
      const firstClipDuration = splitTime - originalClip.start_time;
      const secondClipDuration = originalClip.end_time - splitTime;
      
      const trimDuration = (originalClip.trim_end || originalDuration) - originalClip.trim_start;
      const trimRatio = firstClipDuration / originalDuration;
      
      const firstClipTrimEnd = originalClip.trim_start + (trimDuration * trimRatio);

      // Update first clip
      const { data: firstClip, error: updateError } = await this.supabase
        .from('timeline_clips')
        .update({
          end_time: splitTime,
          trim_end: firstClipTrimEnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', clipId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Create second clip
      const { data: secondClip, error: insertError } = await this.supabase
        .from('timeline_clips')
        .insert({
          track_id: originalClip.track_id,
          asset_id: originalClip.asset_id,
          start_time: splitTime,
          end_time: originalClip.end_time,
          layer_index: originalClip.layer_index,
          trim_start: firstClipTrimEnd,
          trim_end: originalClip.trim_end,
          volume: originalClip.volume,
          is_muted: originalClip.is_muted,
          audio_fade_in: 0, // Reset fades for new clip
          audio_fade_out: originalClip.audio_fade_out,
          opacity: originalClip.opacity,
          transform_data: originalClip.transform_data,
          playback_speed: originalClip.playback_speed,
          reverse_playback: originalClip.reverse_playback
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return [firstClip, secondClip];
    } catch (error) {
      console.error('Error splitting clip:', error);
      return null;
    }
  }

  // ============================================================================
  // EFFECTS MANAGEMENT
  // ============================================================================

  /**
   * Add visual effect to clip
   */
  static async addClipEffect(effect: ClipEffectInsert): Promise<ClipEffect | null> {
    try {
      const { data, error } = await this.supabase
        .from('clip_effects')
        .insert({
          ...effect,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding clip effect:', error);
      return null;
    }
  }

  /**
   * Add audio effect to clip
   */
  static async addAudioEffect(effect: AudioEffectInsert): Promise<AudioEffect | null> {
    try {
      const { data, error } = await this.supabase
        .from('audio_effects')
        .insert({
          ...effect,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding audio effect:', error);
      return null;
    }
  }

  /**
   * Add text element to clip
   */
  static async addTextElement(textElement: TextElementInsert): Promise<TextElement | null> {
    try {
      const { data, error } = await this.supabase
        .from('text_elements')
        .insert({
          ...textElement,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding text element:', error);
      return null;
    }
  }

  /**
   * Add transition between clips
   */
  static async addTransition(transition: ClipTransitionInsert): Promise<ClipTransition | null> {
    try {
      const { data, error } = await this.supabase
        .from('clip_transitions')
        .insert(transition)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding transition:', error);
      return null;
    }
  }

  /**
   * Add keyframe for animation
   */
  static async addKeyframe(keyframe: KeyframeInsert): Promise<Keyframe | null> {
    try {
      const { data, error } = await this.supabase
        .from('keyframes')
        .insert(keyframe)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding keyframe:', error);
      return null;
    }
  }

  // ============================================================================
  // TIMELINE DATA RETRIEVAL
  // ============================================================================

  /**
   * Get complete timeline data for a project
   */
  static async getCompleteTimeline(projectId: string) {
    try {
      const [tracks, clips] = await Promise.all([
        this.getProjectTracks(projectId),
        this.getProjectClips(projectId)
      ]);

      // Get all related data for the clips
      const clipIds = clips.map(clip => clip.id);
      
      const [effects, audioEffects, textElements, transitions, keyframes] = await Promise.all([
        this.getClipEffects(clipIds),
        this.getAudioEffects(clipIds),
        this.getTextElements(clipIds),
        this.getTransitions(clipIds),
        this.getKeyframes(clipIds)
      ]);

      return {
        tracks,
        clips,
        effects,
        audioEffects,
        textElements,
        transitions,
        keyframes
      };
    } catch (error) {
      console.error('Error getting complete timeline:', error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static async getClipEffects(clipIds: string[]): Promise<ClipEffect[]> {
    if (clipIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('clip_effects')
      .select('*')
      .in('clip_id', clipIds)
      .order('effect_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private static async getAudioEffects(clipIds: string[]): Promise<AudioEffect[]> {
    if (clipIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('audio_effects')
      .select('*')
      .in('clip_id', clipIds)
      .order('effect_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  private static async getTextElements(clipIds: string[]): Promise<TextElement[]> {
    if (clipIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('text_elements')
      .select('*')
      .in('clip_id', clipIds);

    if (error) throw error;
    return data || [];
  }

  private static async getTransitions(clipIds: string[]): Promise<ClipTransition[]> {
    if (clipIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('clip_transitions')
      .select('*')
      .or(`from_clip_id.in.(${clipIds.join(',')}),to_clip_id.in.(${clipIds.join(',')})`);

    if (error) throw error;
    return data || [];
  }

  private static async getKeyframes(clipIds: string[]): Promise<Keyframe[]> {
    if (clipIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('keyframes')
      .select('*')
      .in('clip_id', clipIds)
      .order('time_offset', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Save recovery point for project
   */
  static async saveRecoveryPoint(projectId: string, projectState: any, assetManifest: any[]): Promise<boolean> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();

      const { error } = await this.supabase
        .from('project_recovery_points')
        .insert({
          project_id: projectId,
          device_fingerprint: fingerprint,
          project_state: projectState,
          asset_manifest: assetManifest,
          auto_generated: true
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving recovery point:', error);
      return false;
    }
  }
} 