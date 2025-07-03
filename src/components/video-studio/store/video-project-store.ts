import { createStore } from "zustand";
import { nanoid } from "nanoid";
import { VideoProjectService, createAutoSave } from "@/services/video-projects";
import { VideoEditorProject, ProjectData, UserAsset } from "@/types/database";
import { MediaAssetService } from "@/services/media-assets";

// Auto-save debounce delay (3 seconds)
const AUTO_SAVE_DELAY = 3000;

// Re-export database types for compatibility
export type MediaAsset = UserAsset;

// Helper function to extract media info from UserAsset
export const getMediaInfo = (asset: UserAsset) => {
  const isVideo = asset.content_type.startsWith('video/');
  const isAudio = asset.content_type.startsWith('audio/');
  const isImage = asset.content_type.startsWith('image/');
  
  return {
    type: isVideo ? 'video' : isAudio ? 'audio' : 'image' as 'video' | 'audio' | 'image',
    url: VideoProjectService.getAssetUrl(asset), // Use the new storage-aware method
    name: asset.title,
    duration: asset.duration_seconds,
    metadata: {
      width: asset.dimensions?.width,
      height: asset.dimensions?.height,
      fps: asset.video_metadata?.fps,
      size: asset.file_size_bytes,
    }
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
      id: nanoid(),
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
      id: nanoid(),
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
      id: nanoid(),
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
    // Create auto-save instance for this project
    const autoSave = createAutoSave(projectId);

    // Helper to trigger auto-save with current state
    const triggerAutoSave = () => {
      const state = get();
      const projectData: ProjectData = {
        tracks: state.project.tracks.map(track => ({
          id: track.id,
          type: track.type,
          name: track.name,
          position: state.project.tracks.indexOf(track),
          settings: {
            volume: track.volume,
            opacity: track.opacity,
            locked: track.locked,
            visible: track.visible,
            blendMode: track.blendMode
          }
        })),
        clips: state.project.tracks.flatMap(track => 
          track.clips.map(clip => ({
            id: clip.id,
            trackId: track.id,
            assetId: clip.mediaId,
            startTime: clip.startTime,
            endTime: clip.endTime,
            trimStart: clip.trimStart,
            trimEnd: clip.trimEnd,
            volume: clip.volume,
            isMuted: clip.muted,
            effects: clip.effects?.map(effect => ({
              type: effect.type,
              parameters: effect.parameters
            })) || []
          }))
        ),
        transitions: [],
        effects: [],
        timeline: {
          zoom: state.timelineZoom,
          scroll: state.timelineScroll,
          currentTime: state.currentTime
        }
      };
      autoSave(projectData);
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
    addMediaAsset: (asset) => {
      set((state) => ({
        project: {
          ...state.project,
          mediaAssets: [
            ...state.project.mediaAssets,
            asset as MediaAsset,  // Asset already has all required fields
          ],
          updatedAt: new Date(),
        },
      }));
      triggerAutoSave();
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
          id: nanoid(),
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
    addClip: (clip) => {
      set((state) => {
        const newClip: TimelineClip = {
          ...clip,
          id: nanoid(),
          muted: clip.muted ?? false, // Default to not muted
        };

        return {
          project: {
            ...state.project,
            tracks: state.project.tracks.map((track) =>
              track.id === clip.trackId
                ? { ...track, clips: [...track.clips, newClip] }
                : track
            ),
            updatedAt: new Date(),
          },
        };
      });
      triggerAutoSave();
    },

    removeClip: (id) => {
      set((state) => ({
        project: {
          ...state.project,
          tracks: state.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((clip) => clip.id !== id),
          })),
          updatedAt: new Date(),
        },
      }));
      triggerAutoSave();
    },

    updateClip: (id, updates) => {
      set((state) => ({
        project: {
          ...state.project,
          tracks: state.project.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === id ? { ...clip, ...updates } : clip
            ),
          })),
          updatedAt: new Date(),
        },
      }));
      triggerAutoSave();
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
          id: nanoid(),
          endTime: splitTime,
          trimEnd: trimSplitPoint,
        };
        
        // Create second clip (from split to end)
        const secondClip: TimelineClip = {
          ...clipToSplit,
          id: nanoid(),
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
        // Convert store project format to database format
        const projectData: ProjectData = {
          tracks: state.project.tracks.map(track => ({
            id: track.id,
            type: track.type,
            name: track.name,
            position: state.project.tracks.indexOf(track),
            settings: {
              volume: track.volume,
              opacity: track.opacity,
              locked: track.locked,
              visible: track.visible,
              blendMode: track.blendMode
            }
          })),
          clips: state.project.tracks.flatMap(track => 
            track.clips.map(clip => ({
              id: clip.id,
              trackId: track.id,
              assetId: clip.mediaId,
              startTime: clip.startTime,
              endTime: clip.endTime,
              trimStart: clip.trimStart,
              trimEnd: clip.trimEnd,
              volume: clip.volume,
              isMuted: clip.muted,
              effects: clip.effects?.map(effect => ({
                type: effect.type,
                parameters: effect.parameters
              })) || []
            }))
          ),
          transitions: [], // TODO: Add transition support
          effects: [],
          timeline: {
            zoom: state.timelineZoom,
            scroll: state.timelineScroll,
            currentTime: state.currentTime
          }
        };

        await VideoProjectService.updateProject(state.project.id, {
          title: state.project.name,
          resolution: state.project.resolution,
          fps: state.project.fps,
          duration_seconds: state.project.duration,
          project_data: projectData
        });

        console.log("Project saved successfully:", state.project.id);
      } catch (error) {
        console.error("Failed to save project:", error);
        throw error;
      }
    },

    loadProject: async (projectId) => {
      try {
        // Bypass cache to avoid circular dependency (store -> service -> orchestrator -> cache)
        const dbProject = await VideoProjectService.getProject(projectId, true);
        
        // Convert database format to store format
        const project: VideoProject = {
          id: dbProject.id,
          name: dbProject.title,
          tracks: dbProject.project_data.tracks?.map(dbTrack => ({
            id: dbTrack.id,
            type: dbTrack.type,
            name: dbTrack.name,
            clips: dbProject.project_data.clips
              ?.filter(clip => clip.trackId === dbTrack.id)
              .map(clip => ({
                id: clip.id,
                mediaId: clip.assetId || '',
                trackId: clip.trackId,
                startTime: clip.startTime,
                endTime: clip.endTime,
                trimStart: clip.trimStart || 0,
                trimEnd: clip.trimEnd || (clip.endTime - clip.startTime),
                volume: clip.volume || 1,
                muted: clip.isMuted || false,
                effects: clip.effects?.map(effect => ({
                  id: nanoid(),
                  type: effect.type,
                  parameters: effect.parameters,
                  enabled: true
                })) || []
              })) || [],
            muted: false,
            volume: dbTrack.settings?.volume || 1,
            locked: dbTrack.settings?.locked || false,
            visible: dbTrack.settings?.visible !== false,
            height: dbTrack.type === 'video' ? 80 : 60,
            ...(dbTrack.type === 'overlay' && {
              opacity: dbTrack.settings?.opacity || 1,
              blendMode: (dbTrack.settings?.blendMode as any) || 'normal'
            })
          })) || [],
          mediaAssets: [], // Will be loaded separately
          duration: dbProject.duration_seconds,
          fps: dbProject.fps,
          resolution: dbProject.resolution,
          createdAt: new Date(dbProject.created_at),
          updatedAt: new Date(dbProject.updated_at)
        };

        // Restore timeline state
        if (dbProject.project_data.timeline) {
          set({
            project,
            timelineZoom: dbProject.project_data.timeline.zoom || 1,
            timelineScroll: dbProject.project_data.timeline.scroll || 0,
            currentTime: dbProject.project_data.timeline.currentTime || 0
          });
        } else {
          set({ project });
        }

        console.log("Project loaded successfully:", projectId);
      } catch (error) {
        console.error("Failed to load project:", error);
        throw error;
      }
    },

    exportProject: async (format) => {
      const state = get();
      set({ exportDialogOpen: true });
      // TODO: Implement project export using Remotion
      console.log("Exporting project:", state.project, "format:", format);
    },
  };
}); 