import { createStore } from "zustand/vanilla";
import { VideoStudioService } from "@/services/video-studio-service";
import { VideoStudioProject, TimelineData } from "@/types/video-studio-database";
import { UserAsset } from "@/types/database";
import { AutoSaveSystem } from "@/lib/auto-save/auto-save-system";

// Generate proper UUIDs for database compatibility
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Re-export database types for compatibility
export type MediaAsset = UserAsset;

// Helper function to get media info from UserAsset
export const getMediaInfo = (asset: UserAsset | any) => {
  let type: 'video' | 'audio' | 'image' | 'unknown' = 'unknown';
  
  // Handle both UserAsset format and the legacy format
  const contentType = asset.content_type || asset.metadata?.type || '';
  
  if (contentType && typeof contentType === 'string') {
    if (contentType.startsWith('video/')) {
      type = 'video';
    } else if (contentType.startsWith('audio/')) {
      type = 'audio';
    } else if (contentType.startsWith('image/')) {
      type = 'image';
    }
  } else if (asset.type) {
    // Fallback to legacy format
    type = asset.type;
  }
  
  return {
    id: asset.id,
    type,
    url: asset.r2_object_key || asset.url, // Handle both formats
    name: asset.file_name || asset.name,   // Handle both formats
    duration: asset.duration_seconds || asset.duration,
    metadata: {
      size: asset.file_size_bytes || asset.metadata?.size,
      width: asset.dimensions?.width || asset.metadata?.width,
      height: asset.dimensions?.height || asset.metadata?.height,
      fps: asset.video_metadata?.fps || asset.metadata?.fps,
    },
    createdAt: asset.created_at ? new Date(asset.created_at) : asset.createdAt || new Date(),
  };
};

export interface TimelineClip {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number;
  endTime: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  muted: boolean;
  effects: Effect[];
}

export interface Effect {
  id: string;
  type: string;
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface Track {
  id: string;
  type: "video" | "audio" | "overlay";
  name: string;
  clips: TimelineClip[];
  muted: boolean;
  volume: number;
  locked: boolean;
  visible: boolean;
  height: number;
  opacity?: number; // For overlay tracks
  blendMode?: "normal" | "multiply" | "screen" | "overlay"; // For overlay tracks
}

export interface VideoProject {
  id: string;
  name: string;
  tracks: Track[];
  mediaAssets: MediaAsset[];
  duration: number;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoProjectState {
  // Project data
  project: VideoProject;
  
  // Playback state
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  
  // UI state
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedMediaId: string | null;
  timelineZoom: number;
  timelineScroll: number;
  
  // Dialog states
  projectDialogOpen: boolean;
  exportDialogOpen: boolean;
  keyDialogOpen: boolean;
  
  // AI generation state
  isGenerating: boolean;
  generationProgress: number;
  
  // Actions
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  
  // Media management
  addMediaAsset: (asset: Omit<MediaAsset, "id" | "createdAt">) => void;
  removeMediaAsset: (id: string) => void;
  setSelectedMediaId: (id: string | null) => void;
  
  // Track management
  addTrack: (type: "video" | "audio" | "overlay") => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  setSelectedTrackId: (id: string | null) => void;
  
  // Clip management
  addClip: (clip: Omit<TimelineClip, "id">) => void;
  removeClip: (id: string) => void;
  updateClip: (id: string, updates: Partial<TimelineClip>) => void;
  setSelectedClipId: (id: string | null) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  
  // Timeline controls
  setTimelineZoom: (zoom: number) => void;
  setTimelineScroll: (scroll: number) => void;
  
  // Dialog controls
  setProjectDialogOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setKeyDialogOpen: (open: boolean) => void;
  
  // AI generation
  setIsGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  
  // Project management
  saveProject: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  exportProject: (format: string) => Promise<void>;
}

const createDefaultProject = (projectId: string): VideoProject => ({
  id: projectId,
  name: "Untitled Project",
  tracks: [
    {
      id: generateUUID(),
      type: "overlay",
      name: "Overlay Track",
      clips: [],
      muted: false,
      volume: 1,
      locked: false,
      visible: true,
      height: 60,
      opacity: 1,
      blendMode: "normal",
    },
    {
      id: generateUUID(),
      type: "video",
      name: "Video Track 1",
      clips: [],
      muted: false,
      volume: 1,
      locked: false,
      visible: true,
      height: 80,
    },
    {
      id: generateUUID(),
      type: "audio",
      name: "Audio Track 1",
      clips: [],
      muted: false,
      volume: 1,
      locked: false,
      visible: true,
      height: 60,
    },
  ],
  mediaAssets: [],
  duration: 0, // Start with 0 duration, will update based on content
  fps: 30,
  resolution: {
    width: 1920,
    height: 1080,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

export type VideoProjectStore = ReturnType<typeof createVideoProjectStore>;

export const createVideoProjectStore = ({ projectId }: { projectId: string }) =>
  createStore<VideoProjectState>((set, get) => {
    
    // Helper function to queue auto-save after state changes
    const queueAutoSave = (updatedProject: VideoProject) => {
      const autoSave = AutoSaveSystem.getInstance();
      autoSave.queueSave(updatedProject.id, { 
        type: 'project', 
        data: { 
          updated_at: updatedProject.updatedAt.toISOString(),
          file_count: updatedProject.mediaAssets.length,
          total_file_size: updatedProject.mediaAssets.reduce((sum, a) => sum + a.file_size_bytes, 0)
        } 
      });
    };
    
    return {
    // Initial state
    project: createDefaultProject(projectId),
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    selectedClipId: null,
    selectedTrackId: null,
    selectedMediaId: null,
    timelineZoom: 1,
    timelineScroll: 0,
    projectDialogOpen: false,
    exportDialogOpen: false,
    keyDialogOpen: false,
    isGenerating: false,
    generationProgress: 0,

    // Playback actions
    setCurrentTime: (time) => set({ currentTime: time }),
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setPlaybackRate: (rate) => set({ playbackRate: rate }),

    // Media management
    addMediaAsset: async (asset) => {
      try {
        // First, save asset to database to get proper ID
        const dbAsset = await VideoStudioService.createAsset({
          fingerprint: asset.r2_object_key, // Use r2_object_key as fingerprint
          original_filename: asset.file_name,
          content_type: asset.content_type,
          file_size_bytes: asset.file_size_bytes,
          duration_seconds: asset.duration_seconds,
          width: asset.dimensions?.width,
          height: asset.dimensions?.height,
          video_codec: asset.video_metadata?.codec,
          audio_codec: asset.video_metadata?.codec, // Use same codec for audio
        });

        // Then update local state with database asset
        set((state) => {
          const newProject = {
            ...state.project,
            mediaAssets: [
              ...state.project.mediaAssets,
              {
                ...asset,
                id: dbAsset.id, // Use database-generated ID
                created_at: dbAsset.created_at,
                updated_at: dbAsset.updated_at,
              },
            ],
            updatedAt: new Date(),
          };
          
          // Queue auto-save for project metadata
          queueAutoSave(newProject);
          
          return { project: newProject };
        });

        console.log("✅ Asset saved to database:", dbAsset.id, asset.file_name);
      } catch (error) {
        console.error("❌ Failed to save asset to database:", error);
        
        // Fallback: add to local state only with warning
        set((state) => {
          const newProject = {
            ...state.project,
            mediaAssets: [
              ...state.project.mediaAssets,
              {
                ...asset,
                id: generateUUID(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            updatedAt: new Date(),
          };
          
          return { project: newProject };
        });
      }
    },

    removeMediaAsset: (id) =>
      set((state) => ({
        project: {
          ...state.project,
          mediaAssets: state.project.mediaAssets.filter((asset) => asset.id !== id),
          updatedAt: new Date(),
        },
      })),

    setSelectedMediaId: (id) => set({ selectedMediaId: id }),

    // Track management
    addTrack: (type) =>
      set((state) => {
        const trackNumber = state.project.tracks.filter((t) => t.type === type).length + 1;
        const newTrack: Track = {
          id: generateUUID(),
          type,
          name: `${type === "video" ? "Video" : type === "audio" ? "Audio" : "Overlay"} Track ${trackNumber}`,
          clips: [],
          muted: false,
          volume: 1,
          locked: false,
          visible: true,
          height: type === "video" ? 80 : 60,
          ...(type === "overlay" && {
            opacity: 1,
            blendMode: "normal" as const,
          }),
        };

        return {
          project: {
            ...state.project,
            tracks: [...state.project.tracks, newTrack],
            updatedAt: new Date(),
          },
        };
      }),

    removeTrack: (id) =>
      set((state) => ({
        project: {
          ...state.project,
          tracks: state.project.tracks.filter((track) => track.id !== id),
          updatedAt: new Date(),
        },
      })),

    updateTrack: (id, updates) =>
      set((state) => ({
        project: {
          ...state.project,
          tracks: state.project.tracks.map((track) =>
            track.id === id ? { ...track, ...updates } : track
          ),
          updatedAt: new Date(),
        },
      })),

    setSelectedTrackId: (id) => set({ selectedTrackId: id }),

    // Clip management
    addClip: (clip) =>
      set((state) => {
        const newClip: TimelineClip = {
          ...clip,
          id: generateUUID(), // Fixed: Use proper UUID instead of nanoid
          muted: clip.muted ?? false, // Default to not muted
        };

        const newProject = {
            ...state.project,
            tracks: state.project.tracks.map((track) =>
              track.id === clip.trackId
                ? { ...track, clips: [...track.clips, newClip] }
                : track
            ),
            updatedAt: new Date(),
        };

        // Queue auto-save with clip data (only if asset exists)
        if (newClip.mediaId) {
          const autoSave = AutoSaveSystem.getInstance();
          autoSave.queueSave(newProject.id, { 
            type: 'clip', 
            data: {
              id: newClip.id,
              project_id: newProject.id,
              track_id: newClip.trackId,
              asset_id: newClip.mediaId,
              start_time: newClip.startTime,
              end_time: newClip.endTime,
              layer_index: 0,
              trim_start: newClip.trimStart,
              trim_end: newClip.trimEnd,
              position_x: 0,
              position_y: 0,
              scale_x: 1,
              scale_y: 1,
              rotation: 0,
              anchor_x: 0.5,
              anchor_y: 0.5,
              opacity: 1,
              blend_mode: 'normal',
              volume: newClip.volume,
              muted: newClip.muted,
              playback_rate: 1,
              video_effects: [],
              audio_effects: [],
              motion_blur_enabled: false,
              motion_blur_shutter_angle: 180,
              quality_level: 'high',
              tags: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } 
          });
          console.log(`🎬 Queued clip save: ${newClip.id} → asset: ${newClip.mediaId}`);
        } else {
          console.warn(`⚠️ Skipping clip save - no asset ID: ${newClip.id}`);
        }

        return {
          project: newProject,
        };
      }),

    removeClip: (id) =>
      set((state) => ({
        project: {
          ...state.project,
          tracks: state.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((clip) => clip.id !== id),
          })),
          updatedAt: new Date(),
        },
      })),

    updateClip: async (clipId: string, updates: Partial<TimelineClip>) => {
        set((state) => ({
          project: {
            ...state.project,
            tracks: state.project.tracks.map((track) => ({
              ...track,
              clips: track.clips.map((clip) =>
                clip.id === clipId ? { ...clip, ...updates } : clip
              ),
            })),
          },
        }));
        
        // Auto-save after clip update
        const { project } = get();
        const autoSave = AutoSaveSystem.getInstance();
        
        // Save clip updates to database
        try {
          const clipData: any = {
            ...updates,
            // Include overlay transform if present
            overlay_transform: updates.overlayTransform || undefined
          };
          
          // Remove internal properties before saving
          delete clipData.overlayTransform;
          delete clipData.mediaId;
          delete clipData.trackId;
          
          await VideoStudioService.updateClip(clipId, clipData);
          console.log('✅ Clip updated in database:', clipId);
        } catch (error) {
          console.error('❌ Failed to update clip in database:', error);
        }
        
        await autoSave.trackChange(project.id, 'clip', {
          action: 'update',
          clipId,
          updates
        });
      },

    setSelectedClipId: (id) => set({ selectedClipId: id }),

    // Split clip functionality
    splitClip: (clipId, splitTime) =>
      set((state) => {
        const project = state.project;
        
        // Find the clip to split
        let clipToSplit: TimelineClip | null = null;
        let trackId: string | null = null;
        
        for (const track of project.tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) {
            clipToSplit = clip;
            trackId = track.id;
            break;
          }
        }
        
        if (!clipToSplit || !trackId) {
          console.warn('Clip not found for splitting:', clipId);
          return state;
        }
        
        // Validate split time is within clip bounds
        if (splitTime <= clipToSplit.startTime || splitTime >= clipToSplit.endTime) {
          console.warn('Split time is outside clip bounds');
          return state;
        }
        
        // Calculate split positions
        const originalDuration = clipToSplit.endTime - clipToSplit.startTime;
        const timeFromStart = splitTime - clipToSplit.startTime;
        const trimDuration = clipToSplit.trimEnd - clipToSplit.trimStart;
        
        // Calculate trim positions for split
        const trimSplitPoint = clipToSplit.trimStart + (timeFromStart / originalDuration) * trimDuration;
        
        // Create first clip (from start to split)
        const firstClip: TimelineClip = {
          ...clipToSplit,
          id: generateUUID(), // Fixed: Use proper UUID instead of nanoid
          endTime: splitTime,
          trimEnd: trimSplitPoint,
        };
        
        // Create second clip (from split to end)
        const secondClip: TimelineClip = {
          ...clipToSplit,
          id: generateUUID(), // Fixed: Use proper UUID instead of nanoid
          startTime: splitTime,
          trimStart: trimSplitPoint,
        };
        
        // Update the project with new clips
        const updatedTracks = project.tracks.map(track => {
          if (track.id === trackId) {
            // Remove original clip and add the two new clips
            const clipsWithoutOriginal = track.clips.filter(c => c.id !== clipId);
            return {
              ...track,
              clips: [...clipsWithoutOriginal, firstClip, secondClip]
            };
          }
          return track;
        });
        
        return {
          project: {
            ...project,
            tracks: updatedTracks,
            updatedAt: new Date(),
          },
          selectedClipId: firstClip.id, // Select the first clip after split
        };
      }),

    // Timeline controls
    setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
    setTimelineScroll: (scroll) => set({ timelineScroll: scroll }),

    // Dialog controls
    setProjectDialogOpen: (open) => set({ projectDialogOpen: open }),
    setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
    setKeyDialogOpen: (open) => set({ keyDialogOpen: open }),

    // AI generation
    setIsGenerating: (generating) => set({ isGenerating: generating }),
    setGenerationProgress: (progress) => set({ generationProgress: progress }),

    // Project management
    saveProject: async () => {
      const state = get();
      try {
        // Convert store format to database format and save
        const timelineData: TimelineData = {
          project: {
            id: state.project.id,
            title: state.project.name,
            resolution_width: state.project.resolution.width,
            resolution_height: state.project.resolution.height,
            fps: state.project.fps,
            duration_seconds: state.project.duration,
            updated_at: new Date().toISOString(),
            created_at: state.project.createdAt.toISOString(),
          } as VideoStudioProject,
          tracks: state.project.tracks.map(track => ({
            id: track.id,
            project_id: state.project.id,
            name: track.name,
            type: track.type,
            position: state.project.tracks.indexOf(track),
            height: track.height,
            volume: track.volume,
            opacity: track.opacity || 1.0,
            muted: track.muted,
            locked: track.locked,
            visible: track.visible,
            blend_mode: track.blendMode || 'normal',
            pan: 0.0,
            solo: false,
            color: '#3b82f6',
            audio_effects: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
          clips: state.project.tracks.flatMap(track => 
            track.clips.map(clip => ({
              id: clip.id,
              project_id: state.project.id,
              track_id: track.id,
              asset_id: clip.mediaId || undefined,
              start_time: clip.startTime,
              end_time: clip.endTime,
              layer_index: 0,
              trim_start: clip.trimStart,
              trim_end: clip.trimEnd,
              position_x: 0,
              position_y: 0,
              scale_x: 1.0,
              scale_y: 1.0,
              rotation: 0.0,
              anchor_x: 0.5,
              anchor_y: 0.5,
              opacity: 1.0,
              blend_mode: 'normal',
              volume: clip.volume,
              muted: clip.muted,
              playback_rate: 1.0,
              video_effects: [],
              audio_effects: [],
              motion_blur_enabled: false,
              motion_blur_shutter_angle: 180.0,
              quality_level: 'high',
              tags: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
          ),
          keyframes: [],
          transitions: [],
          assets: state.project.mediaAssets.map(asset => ({
            id: asset.id,
            user_id: asset.user_id,
            fingerprint: asset.r2_object_key,
            original_filename: asset.file_name,
            content_type: asset.content_type,
            file_size_bytes: asset.file_size_bytes,
            duration_seconds: asset.duration_seconds,
            width: asset.dimensions?.width,
            height: asset.dimensions?.height,
            fps: asset.video_metadata?.fps,
            video_codec: asset.video_metadata?.codec,
            audio_codec: asset.video_metadata?.codec,
            bitrate_kbps: asset.video_metadata?.bitrate ? parseInt(asset.video_metadata.bitrate) : undefined,
            audio_channels: asset.video_metadata?.audio_channels || 2,
            audio_sample_rate: asset.video_metadata?.audio_sample_rate || 44100,
            analysis_status: 'pending',
            proxy_status: 'pending',
            thumbnail_status: 'pending',
            usage_count: 0,
            projects_used_in: [state.project.id],
            proxy_cache_keys: {},
            created_at: asset.created_at,
            updated_at: asset.updated_at,
            last_accessed_at: new Date().toISOString(),
          })),
        };

        // Save to database via VideoStudioService
        await VideoStudioService.updateProjectTimeline(state.project.id, timelineData);
        
        // Queue auto-save for background persistence
        const autoSave = AutoSaveSystem.getInstance();
        autoSave.queueSave(state.project.id, { type: 'timeline', data: timelineData });
        
        console.log("✅ Project saved successfully:", state.project.id);
      } catch (error) {
        console.error("❌ Failed to save project:", error);
        throw error;
      }
    },

    loadProject: async (projectId) => {
      try {
        const timelineData = await VideoStudioService.getTimelineData(projectId);
        
        // Convert database format to store format
        const videoProject: VideoProject = {
          id: timelineData.project.id,
          name: timelineData.project.title,
          resolution: {
            width: timelineData.project.resolution_width,
            height: timelineData.project.resolution_height,
          },
          fps: timelineData.project.fps,
          duration: timelineData.project.duration_seconds,
          tracks: timelineData.tracks.map(track => ({
            id: track.id,
            type: track.type as "video" | "audio" | "overlay",
            name: track.name,
            clips: timelineData.clips
              .filter(clip => clip.track_id === track.id)
              .map(clip => ({
                id: clip.id,
                mediaId: clip.asset_id || '',
                trackId: clip.track_id,
                startTime: clip.start_time,
                endTime: clip.end_time,
                trimStart: clip.trim_start,
                trimEnd: clip.trim_end || clip.end_time,
                volume: clip.volume,
                muted: clip.muted,
                effects: [] // TODO: Map effects
              })),
            muted: track.muted,
            volume: track.volume,
            locked: track.locked,
            visible: track.visible,
            height: track.height,
            opacity: track.opacity,
            blendMode: track.blend_mode as any
          })),
          mediaAssets: timelineData.assets.map(asset => ({
            id: asset.id,
            user_id: asset.user_id,
            title: asset.original_filename,
            file_name: asset.original_filename,
            source_studio: 'video-studio',
            tags: [],
            r2_object_key: asset.fingerprint,
            content_type: asset.content_type,
            file_size_bytes: asset.file_size_bytes,
            duration_seconds: asset.duration_seconds,
            dimensions: asset.width && asset.height ? {
              width: asset.width,
              height: asset.height
            } : undefined,
            video_metadata: asset.fps ? {
              fps: asset.fps,
              codec: asset.video_codec,
              bitrate: asset.bitrate_kbps?.toString(),
              audio_channels: asset.audio_channels,
              audio_sample_rate: asset.audio_sample_rate
            } : undefined,
            created_at: asset.created_at,
            updated_at: asset.updated_at
          })),
          createdAt: new Date(timelineData.project.created_at),
          updatedAt: new Date(timelineData.project.updated_at),
        };

        // Update store state
        set({ project: videoProject });
        
        console.log("✅ Project loaded successfully:", projectId);
      } catch (error) {
        console.error("❌ Failed to load project:", error);
        throw error;
      }
    },

    exportProject: async (format) => {
      const state = get();
      set({ exportDialogOpen: true });
      try {
      // TODO: Implement project export using Remotion
        console.log("🎬 Exporting project:", state.project.id, "format:", format);
        
        // For now, just record the export action
        await VideoStudioService.recordAction(
          state.project.id,
          'project_settings',
          { action: 'export', format },
          undefined
        );
      } catch (error) {
        console.error("❌ Export failed:", error);
        throw error;
      }
    },
  };
}); 