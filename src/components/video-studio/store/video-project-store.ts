import { createStore } from "zustand/vanilla";
import { VideoStudioService } from "@/services/video-studio-service";
import { VideoStudioProject, TimelineData } from "@/types/video-studio-database";
import { UserAsset } from "@/types/database";
import { AutoSaveSystem } from "@/lib/auto-save/auto-save-system";
import { videoStudioDB } from "@/lib/indexeddb/video-studio-db";

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

// Cache for blob URLs to prevent regeneration and memory leaks
const mediaUrlCache = new Map<string, { url: string; expiry: number }>();
const URL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Helper function to get media info from UserAsset with IndexedDB blob URL support
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
  
  // **PRODUCTION FIX: Use stable fingerprint for caching, separate from blob URL**
  const fingerprint = asset.fingerprint || asset.r2_object_key;
  let url = asset.url || fingerprint; // Use pre-resolved URL if available
  
  // Only check cache if we don't already have a blob URL
  if (!url.startsWith('blob:')) {
    const cached = mediaUrlCache.get(fingerprint);
    if (cached && Date.now() < cached.expiry) {
      url = cached.url;
    } else if (cached) {
      // Clean up expired cache entry
      mediaUrlCache.delete(fingerprint);
    }
  }
  
  return {
    id: asset.id,
    type,
    url, // Will be the blob URL if available, otherwise fingerprint
    fingerprint, // Keep fingerprint for IndexedDB operations
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

/**
 * Production-grade async function to resolve media URLs from IndexedDB
 * This extends the existing getMediaInfo with blob URL generation
 */
export const getMediaInfoWithBlobUrl = async (asset: UserAsset | any) => {
  const mediaInfo = getMediaInfo(asset);
  
  // If URL is already a blob URL or HTTP URL, return as-is
  if (mediaInfo.url.startsWith('blob:') || mediaInfo.url.startsWith('http')) {
    return mediaInfo;
  }
  
  // Check cache first
  const cached = mediaUrlCache.get(mediaInfo.fingerprint);
  if (cached && Date.now() < cached.expiry) {
    return { ...mediaInfo, url: cached.url };
  }
  
  try {
    // Generate blob URL from IndexedDB
    const blobUrl = await videoStudioDB.getBlobUrl(mediaInfo.fingerprint);
    
    if (blobUrl) {
      // Cache the blob URL
      mediaUrlCache.set(mediaInfo.fingerprint, {
        url: blobUrl,
        expiry: Date.now() + URL_CACHE_TTL
      });
      
      console.log(`🔗 Resolved media URL for ${mediaInfo.name}: ${blobUrl.substring(0, 50)}...`);
      return { ...mediaInfo, url: blobUrl };
    } else {
      console.warn(`⚠️ Could not resolve blob URL for asset: ${mediaInfo.name} (${mediaInfo.fingerprint})`);
      return mediaInfo; // Return with original fingerprint as fallback
    }
  } catch (error) {
    console.error(`❌ Error resolving blob URL for ${mediaInfo.name}:`, error);
    return mediaInfo; // Return with original fingerprint as fallback
  }
};

/**
 * Batch resolve media URLs for multiple assets (performance optimization)
 */
export const getMediaInfosWithBlobUrls = async (assets: (UserAsset | any)[]): Promise<Array<ReturnType<typeof getMediaInfo>>> => {
  // First, get all fingerprints that need blob URL resolution
  const fingerprints: string[] = [];
  const mediaInfos = assets.map(asset => {
    const info = getMediaInfo(asset);
    if (!info.url.startsWith('blob:') && !info.url.startsWith('http')) {
      fingerprints.push(info.fingerprint);
    }
    return info;
  });
  
  try {
    // Batch generate blob URLs
    const blobUrls = await videoStudioDB.getBlobUrls(fingerprints);
    
    // Update media infos with blob URLs
    return mediaInfos.map(info => {
      const blobUrl = blobUrls.get(info.fingerprint);
      if (blobUrl) {
        // Cache the blob URL
        mediaUrlCache.set(info.fingerprint, {
          url: blobUrl,
          expiry: Date.now() + URL_CACHE_TTL
        });
        return { ...info, url: blobUrl };
      }
      return info;
    });
  } catch (error) {
    console.error('❌ Error batch resolving blob URLs:', error);
    return mediaInfos; // Return original infos as fallback
  }
};

/**
 * Clean up expired URL cache entries
 */
export const cleanupMediaUrlCache = () => {
  const now = Date.now();
  for (const [fingerprint, cached] of mediaUrlCache.entries()) {
    if (now >= cached.expiry) {
      mediaUrlCache.delete(fingerprint);
    }
  }
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
  createdAt?: string; // ISO timestamp for database persistence
  updatedAt?: string; // ISO timestamp for database persistence
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
  
  // **NEW: Track database state**
  isProjectInDatabase: boolean;
  
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
  addMediaAsset: (asset: Omit<MediaAsset, "id" | "createdAt">) => Promise<void>;
  removeMediaAsset: (id: string) => void;
  setSelectedMediaId: (id: string | null) => void;
  
  // Track management
  addTrack: (type: "video" | "audio" | "overlay") => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  setSelectedTrackId: (id: string | null) => void;
  
  // Clip management
  addClip: (clip: Omit<TimelineClip, "id">) => Promise<void>;
  removeClip: (id: string) => Promise<void>;
  updateClip: (id: string, updates: Partial<TimelineClip>) => Promise<void>;
  setSelectedClipId: (id: string | null) => void;
  splitClip: (clipId: string, splitTime: number) => Promise<void>;
  
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
  
  // **NEW: Database management**
  ensureProjectInDatabase: () => Promise<void>;
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
    
    return {
      // Initial project state - use provided projectId or create temporary one
      project: createDefaultProject(projectId),
      
      // **NEW: Track if project exists in database**
      isProjectInDatabase: false,

    // Initial state
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
        // **FIX: Ensure project exists in database first**
        const state = get();
        if (!state.isProjectInDatabase) {
          await get().ensureProjectInDatabase();
        }
        
        // **FIX: Check if asset already exists for current user before creating**
        let dbAsset = await VideoStudioService.getAssetByFingerprintForCurrentUser(asset.r2_object_key);
        
        if (!dbAsset) {
          // Asset doesn't exist for current user, create it
          dbAsset = await VideoStudioService.createAsset({
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
          console.log("✅ New asset created in database:", dbAsset.id, asset.file_name);
        } else {
          console.log("♻️ Reusing existing asset from database:", dbAsset.id, asset.file_name);
        }

        // Then update local state with database asset
        set((state) => {
          // **FIX: Check if asset already exists in the project before adding**
          if (state.project.mediaAssets.some(a => a.id === dbAsset.id)) {
            console.warn(`Asset ${dbAsset.id} already in project, skipping.`);
            return state; // Return current state without modification
          }

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
          
          // **FIX: Call the full saveProject to persist all timeline changes**
          get().saveProject();
          
          return { project: newProject };
        });

        console.log("✅ Asset added to project:", dbAsset.id, asset.file_name);
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
    addClip: async (clip) => {
      set((state) => {
        const newClip: TimelineClip = {
          ...clip,
          id: generateUUID(), // Fixed: Use proper UUID instead of nanoid
          muted: clip.muted ?? false, // Default to not muted
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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

        return {
          project: newProject,
        };
      });

      // **FIX: Await the full saveProject to ensure persistence**
      await get().saveProject();
    },

    removeClip: async (id) => {
      set((state) => {
        const newProject = {
          ...state.project,
          tracks: state.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((clip) => clip.id !== id),
          })),
          updatedAt: new Date(),
        };

        return { project: newProject };
      });

      // **FIX: Await the full saveProject to ensure persistence**
      await get().saveProject();
    },

    updateClip: async (id, updates) => {
      set((state) => {
        const newProject = {
          ...state.project,
          tracks: state.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === id ? { ...clip, ...updates } : clip
            ),
          })),
          updatedAt: new Date(),
        };

        return { project: newProject };
      });

      // **FIX: Await the full saveProject to ensure persistence**
      await get().saveProject();
    },

    setSelectedClipId: (id) => set({ selectedClipId: id }),

    // Split clip functionality
    splitClip: async (clipId, splitTime) => {
      const state = get();
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
        return;
      }
      
      // Validate split time is within clip bounds
      if (splitTime <= clipToSplit.startTime || splitTime >= clipToSplit.endTime) {
        console.warn('Split time is outside clip bounds');
        return;
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Create second clip (from split to end)
      const secondClip: TimelineClip = {
        ...clipToSplit,
        id: generateUUID(), // Fixed: Use proper UUID instead of nanoid
        startTime: splitTime,
        trimStart: trimSplitPoint,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      
      const newProject = {
        ...project,
        tracks: updatedTracks,
        updatedAt: new Date(),
      };

      // Update state first
      set({
        project: newProject,
        selectedClipId: firstClip.id, // Select the first clip after split
      });

      // **FIX: Await the full saveProject to ensure persistence**
      await get().saveProject();
    },

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
              // **PRODUCTION FIX: Preserve original timestamps for existing clips**
              created_at: clip.createdAt || new Date().toISOString(),
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
        await VideoStudioService.saveFullProject(timelineData);
        
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

    // **NEW: Ensure project exists in database**
    ensureProjectInDatabase: async () => {
      const state = get();
      
      if (state.isProjectInDatabase) {
        return; // Already in database
      }
      
      try {
        console.log(`🔄 Creating project ${state.project.id} in database...`);
        
        // Create the project in database
        const dbProject = await VideoStudioService.createProject({
          title: state.project.name,
          description: "Project created from video studio",
          resolution_width: state.project.resolution.width,
          resolution_height: state.project.resolution.height,
          fps: state.project.fps,
          aspect_ratio: '16:9'
        });
        
        // Update the store to reflect the database state
        set({ 
          project: {
            ...state.project,
            id: dbProject.id, // Use database-generated ID
            createdAt: new Date(dbProject.created_at),
            updatedAt: new Date(dbProject.updated_at)
          },
          isProjectInDatabase: true 
        });
        
        console.log(`✅ Project created in database with ID: ${dbProject.id}`);
        
        // Now we can start auto-saving
        const updatedState = get();
        get().saveProject();
        
      } catch (error) {
        console.error("❌ Failed to create project in database:", error);
        throw error;
      }
    },
  };
}); 