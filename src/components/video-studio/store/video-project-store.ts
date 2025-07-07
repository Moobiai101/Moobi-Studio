import { createStore } from "zustand";
import { VideoProjectService, createAutoSave, createTimelineSave } from "@/services/video-projects";
import { TimelineService } from "@/services/timeline-service";
import { DeviceService } from "@/services/device-service";
import { 
  VideoEditorProject, 
  UserAsset, 
  TimelineTrack, 
  TimelineClip,
  ProjectTimelineData,
  ClipEffect,
  AudioEffect,
  TextElement,
  ClipTransition,
  Keyframe,
  TransformData
} from "@/types/database";
import { MediaAssetService } from "@/services/media-assets";
import { indexedDBManager } from "@/lib/storage/indexed-db-manager";

// Auto-save delays
const AUTO_SAVE_DELAY = 3000; // 3 seconds for project state
const TIMELINE_SAVE_DELAY = 1000; // 1 second for timeline changes

// Re-export database types for compatibility
export type MediaAsset = UserAsset;

// Helper function to extract media info from UserAsset
export const getMediaInfo = (asset: UserAsset) => {
  const isVideo = asset.content_type.startsWith('video/');
  const isAudio = asset.content_type.startsWith('audio/');
  const isImage = asset.content_type.startsWith('image/');
  
  // Type guard helpers for Json fields
  const getDimensions = (dimensions: any): { width?: number; height?: number } => {
    if (typeof dimensions === 'object' && dimensions !== null) {
      return {
        width: typeof dimensions.width === 'number' ? dimensions.width : undefined,
        height: typeof dimensions.height === 'number' ? dimensions.height : undefined
      };
    }
    return {};
  };

  const getVideoMetadata = (metadata: any): { fps?: number } => {
    if (typeof metadata === 'object' && metadata !== null) {
      return {
        fps: typeof metadata.fps === 'number' ? metadata.fps : undefined
      };
    }
    return {};
  };

  const dimensions = getDimensions(asset.dimensions);
  const videoMetadata = getVideoMetadata(asset.video_metadata);
  
  return {
    type: isVideo ? 'video' : isAudio ? 'audio' : 'image' as 'video' | 'audio' | 'image',
    url: asset.local_asset_id ? `indexeddb://${asset.local_asset_id}` : MediaAssetService.getAssetUrl(asset.r2_object_key),
    name: asset.title,
    duration: asset.duration_seconds,
    metadata: {
      width: dimensions.width,
      height: dimensions.height,
      fps: videoMetadata.fps,
      size: asset.file_size_bytes,
    }
  };
};

// Enhanced interfaces compatible with new schema
export interface EnhancedTimelineClip extends TimelineClip {
  // Add UI-specific properties
  selected?: boolean;
  effects?: ClipEffect[];
  audioEffects?: AudioEffect[];
  textElements?: TextElement[];
  transitions?: ClipTransition[];
  keyframes?: Keyframe[];
}

export interface EnhancedTimelineTrack extends TimelineTrack {
  // Add UI-specific properties
  clips: EnhancedTimelineClip[];
  height?: number;
  selected?: boolean;
}

export interface VideoProjectState {
  // Project data
  project: VideoEditorProject | null;
  timeline: ProjectTimelineData | null;
  tracks: EnhancedTimelineTrack[];
  mediaAssets: MediaAsset[];
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  
  // Playback state
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  
  // Selection state
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedMediaId: string | null;
  selectedKeyframes: string[];
  
  // Timeline UI state
  timelineZoom: number;
  timelineScroll: number;
  snapToGrid: boolean;
  gridSize: number;
  
  // Dialog states
  projectDialogOpen: boolean;
  exportDialogOpen: boolean;
  keyDialogOpen: boolean;
  mediaGalleryOpen: boolean;
  
  // AI generation state
  isGenerating: boolean;
  generationProgress: number;
  generationStatus: string;
  
  // Device and sync state
  deviceSyncStatus: 'synced' | 'syncing' | 'offline' | 'conflict';
  availableDevices: number;
  
  // Actions - Playback
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  seek: (time: number) => void;
  
  // Actions - Project Management
  initializeProject: (projectId: string) => Promise<void>;
  saveProject: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  createRecoveryPoint: () => Promise<void>;
  
  // Actions - Media Management
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (id: string) => void;
  setSelectedMediaId: (id: string | null) => void;
  refreshMediaAssets: () => Promise<void>;
  
  // Actions - Track Management
  addTrack: (type: 'video' | 'audio' | 'overlay' | 'text') => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  updateTrack: (id: string, updates: Partial<TimelineTrack>) => Promise<void>;
  setSelectedTrackId: (id: string | null) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => Promise<void>;
  
  // Actions - Clip Management
  addClip: (trackId: string, assetId: string, startTime: number, duration?: number) => Promise<void>;
  removeClip: (id: string) => Promise<void>;
  updateClip: (id: string, updates: Partial<TimelineClip>) => Promise<void>;
  setSelectedClipId: (id: string | null) => void;
  splitClip: (clipId: string, splitTime: number) => Promise<void>;
  trimClip: (clipId: string, trimStart: number, trimEnd?: number) => Promise<void>;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => Promise<void>;
  duplicateClip: (clipId: string) => Promise<void>;
  
  // Actions - Effects Management
  addClipEffect: (clipId: string, effectType: string, effectName: string, parameters?: any) => Promise<void>;
  removeClipEffect: (effectId: string) => Promise<void>;
  updateClipEffect: (effectId: string, parameters: any) => Promise<void>;
  addAudioEffect: (clipId: string, effectType: string, effectName: string, parameters?: any) => Promise<void>;
  addTextElement: (clipId: string, text: string, style?: any) => Promise<void>;
  addTransition: (fromClipId: string, toClipId: string, transitionType: string, duration: number) => Promise<void>;
  
  // Actions - Timeline Controls
  setTimelineZoom: (zoom: number) => void;
  setTimelineScroll: (scroll: number) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  
  // Actions - Selection Management
  selectMultipleClips: (clipIds: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  // Actions - Dialog Controls
  setProjectDialogOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setKeyDialogOpen: (open: boolean) => void;
  setMediaGalleryOpen: (open: boolean) => void;
  
  // Actions - AI Generation
  setIsGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setGenerationStatus: (status: string) => void;
  
  // Actions - Device Sync
  updateDeviceActivity: () => Promise<void>;
  checkSyncStatus: () => Promise<void>;
  resolveConflicts: () => Promise<void>;
  
  // Actions - Import/Export
  exportProject: (format: string, settings?: any) => Promise<void>;
  importMedia: (files: File[]) => Promise<void>;
  
  // Actions - History/Undo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export type VideoProjectStore = ReturnType<typeof createVideoProjectStore>;

// Helper function to safely extract timeline data properties
const getTimelineDataProperty = (timelineData: any, property: string, defaultValue: any): any => {
  if (typeof timelineData === 'object' && timelineData !== null && property in timelineData) {
    return timelineData[property];
  }
  return defaultValue;
};

export const createVideoProjectStore = ({ projectId }: { projectId: string }) =>
  createStore<VideoProjectState>((set, get) => {
    // Create auto-save instances for this project
    const autoSave = createAutoSave(projectId);
    const timelineSave = createTimelineSave(projectId);

    // Helper to trigger auto-save with current state
    const triggerAutoSave = () => {
      const state = get();
      if (!state.project) return;
      
      const projectState = {
        project: state.project,
        timeline: state.timeline,
        currentTime: state.currentTime,
        zoom: state.timelineZoom,
        scroll: state.timelineScroll
      };
      
      const assetManifest = state.mediaAssets.map(asset => ({
        id: asset.id,
        local_asset_id: asset.local_asset_id,
        filename: asset.file_name,
        content_type: asset.content_type,
        file_size: asset.file_size_bytes
      }));
      
      autoSave(projectState, assetManifest);
    };

    // Helper to trigger timeline save
    const triggerTimelineSave = () => {
      const state = get();
      if (!state.project) return;
      
      const timelineData = {
        currentTime: state.currentTime,
          zoom: state.timelineZoom,
          scroll: state.timelineScroll,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize
      };
      
      timelineSave(timelineData);
    };

    // Helper to update project duration
    const updateProjectDuration = async () => {
      const state = get();
      if (!state.project) return;
      
      try {
        const duration = await VideoProjectService.calculateProjectDuration(state.project.id);
        set((state) => ({
          project: state.project ? { ...state.project, duration_seconds: duration } : null
        }));
      } catch (error) {
        console.error('Error updating project duration:', error);
      }
    };

    return {
    // Initial state
      project: null,
      timeline: null,
      tracks: [],
      mediaAssets: [],
      
      // Loading states
      isLoading: false,
      isSaving: false,
      lastSaved: null,
      
      // Playback state
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
      
      // Selection state
    selectedClipId: null,
    selectedTrackId: null,
    selectedMediaId: null,
      selectedKeyframes: [],
      
      // Timeline UI state
    timelineZoom: 1,
    timelineScroll: 0,
      snapToGrid: true,
      gridSize: 1,
      
      // Dialog states
    projectDialogOpen: false,
    exportDialogOpen: false,
    keyDialogOpen: false,
      mediaGalleryOpen: false,
      
      // AI generation state
    isGenerating: false,
    generationProgress: 0,
      generationStatus: '',

      // Device and sync state
      deviceSyncStatus: 'synced',
      availableDevices: 1,

      // ============================================================================
      // PLAYBACK ACTIONS
      // ============================================================================

      setCurrentTime: (time) => {
        set({ currentTime: time });
        triggerTimelineSave();
      },
      
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setPlaybackRate: (rate) => set({ playbackRate: rate }),

      seek: (time) => {
        set({ currentTime: time, isPlaying: false });
        triggerTimelineSave();
      },

      // ============================================================================
      // PROJECT MANAGEMENT ACTIONS
      // ============================================================================

      initializeProject: async (projectId: string) => {
        set({ isLoading: true });
        try {
          // Register device
          await DeviceService.registerDevice();
          
          // Load project with timeline data
          const { project, timeline } = await VideoProjectService.getProjectWithTimeline(projectId);
          
          // Load media assets
          const mediaAssets = await VideoProjectService.getUserVideoAssets();
          
          // Convert timeline data to enhanced format
          const enhancedTracks: EnhancedTimelineTrack[] = timeline.tracks.map(track => ({
            ...track,
            clips: timeline.clips
              .filter(clip => clip.track_id === track.id)
              .map(clip => ({
                ...clip,
                effects: timeline.effects.filter(e => e.clip_id === clip.id),
                audioEffects: timeline.audioEffects.filter(e => e.clip_id === clip.id),
                textElements: timeline.textElements.filter(e => e.clip_id === clip.id),
                transitions: timeline.transitions.filter(t => 
                  t.from_clip_id === clip.id || t.to_clip_id === clip.id
                ),
                keyframes: timeline.keyframes.filter(k => k.clip_id === clip.id)
              })),
            height: track.track_type === 'video' ? 80 : 60
          }));
          
          set({
            project,
            timeline,
            tracks: enhancedTracks,
            mediaAssets,
            isLoading: false,
            currentTime: getTimelineDataProperty(project.timeline_data, 'currentTime', 0),
            timelineZoom: getTimelineDataProperty(project.timeline_data, 'zoom', 1),
            timelineScroll: getTimelineDataProperty(project.timeline_data, 'scroll', 0),
            snapToGrid: getTimelineDataProperty(project.timeline_data, 'snapToGrid', true),
            gridSize: getTimelineDataProperty(project.timeline_data, 'gridSize', 1)
          });
          
          // Update device activity
          await DeviceService.updateDeviceActivity();
          
        } catch (error) {
          console.error('Error initializing project:', error);
          set({ isLoading: false });
        }
      },

      saveProject: async () => {
        const state = get();
        if (!state.project) return;
        
        set({ isSaving: true });
        try {
          await VideoProjectService.updateProject(state.project.id, {
            timeline_data: {
              currentTime: state.currentTime,
              zoom: state.timelineZoom,
              scroll: state.timelineScroll,
              snapToGrid: state.snapToGrid,
              gridSize: state.gridSize
            }
          });
          
          set({ isSaving: false, lastSaved: new Date() });
          triggerAutoSave();
        } catch (error) {
          console.error('Error saving project:', error);
          set({ isSaving: false });
        }
      },

      loadProject: async (projectId: string) => {
        await get().initializeProject(projectId);
      },

      createRecoveryPoint: async () => {
        const state = get();
        if (!state.project) return;
        
        const projectState = {
          project: state.project,
          timeline: state.timeline,
          ui_state: {
            currentTime: state.currentTime,
            zoom: state.timelineZoom,
            scroll: state.timelineScroll
          }
        };
        
        const assetManifest = state.mediaAssets.map(asset => ({
          id: asset.id,
          local_asset_id: asset.local_asset_id,
          filename: asset.file_name
        }));
        
        await TimelineService.saveRecoveryPoint(
          state.project.id,
          projectState,
          assetManifest
        );
      },

      // ============================================================================
      // MEDIA MANAGEMENT ACTIONS
      // ============================================================================

    addMediaAsset: (asset) => {
      set((state) => ({
          mediaAssets: [...state.mediaAssets, asset]
      }));
      triggerAutoSave();
    },

      removeMediaAsset: (id) => {
      set((state) => ({
          mediaAssets: state.mediaAssets.filter((asset) => asset.id !== id),
          selectedMediaId: state.selectedMediaId === id ? null : state.selectedMediaId
        }));
        triggerAutoSave();
      },

    setSelectedMediaId: (id) => set({ selectedMediaId: id }),

      refreshMediaAssets: async () => {
        try {
          const mediaAssets = await VideoProjectService.getUserVideoAssets();
          set({ mediaAssets });
        } catch (error) {
          console.error('Error refreshing media assets:', error);
        }
      },

      // ============================================================================
      // TRACK MANAGEMENT ACTIONS
      // ============================================================================

      addTrack: async (type) => {
        const state = get();
        if (!state.project) return;
        
        try {
          const trackNumber = state.tracks.filter((t) => t.track_type === type).length + 1;
          
          const newTrack = await TimelineService.addTrack({
            project_id: state.project.id,
            track_type: type,
            track_name: `${type.charAt(0).toUpperCase() + type.slice(1)} Track ${trackNumber}`,
            track_order: state.tracks.length + 1,
            volume: 1.0,
            opacity: 1.0,
            blend_mode: 'normal'
          });
          
          if (newTrack) {
            const enhancedTrack: EnhancedTimelineTrack = {
              ...newTrack,
          clips: [],
              height: type === 'video' ? 80 : 60
            };
            
            set((state) => ({
              tracks: [...state.tracks, enhancedTrack]
            }));
            
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error adding track:', error);
        }
      },

      removeTrack: async (id) => {
        try {
          await TimelineService.deleteTrack(id);
      set((state) => ({
            tracks: state.tracks.filter((track) => track.id !== id),
            selectedTrackId: state.selectedTrackId === id ? null : state.selectedTrackId
          }));
          triggerAutoSave();
          updateProjectDuration();
        } catch (error) {
          console.error('Error removing track:', error);
        }
      },

      updateTrack: async (id, updates) => {
        try {
          const updatedTrack = await TimelineService.updateTrack(id, updates);
          if (updatedTrack) {
      set((state) => ({
              tracks: state.tracks.map((track) =>
                track.id === id ? { ...track, ...updatedTrack } : track
              )
            }));
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error updating track:', error);
        }
      },

    setSelectedTrackId: (id) => set({ selectedTrackId: id }),

      reorderTracks: async (fromIndex, toIndex) => {
        const state = get();
        const newTracks = [...state.tracks];
        const [movedTrack] = newTracks.splice(fromIndex, 1);
        newTracks.splice(toIndex, 0, movedTrack);
        
        // Update track order in database
        for (let i = 0; i < newTracks.length; i++) {
          await TimelineService.updateTrack(newTracks[i].id, { track_order: i + 1 });
        }
        
        set({ tracks: newTracks });
        triggerAutoSave();
      },

      // ============================================================================
      // CLIP MANAGEMENT ACTIONS
      // ============================================================================

      addClip: async (trackId, assetId, startTime, duration) => {
        try {
          const state = get();
          const asset = state.mediaAssets.find(a => a.id === assetId);
          if (!asset) return;
          
          const clipDuration = duration || asset.duration_seconds || 5;
          
          const newClip = await TimelineService.addClip({
            track_id: trackId,
            asset_id: assetId,
            start_time: startTime,
            end_time: startTime + clipDuration,
            trim_start: 0,
            trim_end: clipDuration,
            volume: 1.0,
            opacity: 1.0,
            transform_data: {
              position: { x: 0, y: 0 },
              scale: { x: 1, y: 1 },
              rotation: 0,
              opacity: 1
            },
            playback_speed: 1.0
          });
          
          if (newClip) {
            const enhancedClip: EnhancedTimelineClip = {
              ...newClip,
              effects: [],
              audioEffects: [],
              textElements: [],
              transitions: [],
              keyframes: []
            };
            
            set((state) => ({
              tracks: state.tracks.map((track) =>
                track.id === trackId
                  ? { ...track, clips: [...track.clips, enhancedClip] }
                : track
              )
            }));
            
      triggerAutoSave();
            updateProjectDuration();
          }
        } catch (error) {
          console.error('Error adding clip:', error);
        }
    },

      removeClip: async (id) => {
        try {
          await TimelineService.deleteClip(id);
      set((state) => ({
            tracks: state.tracks.map((track) => ({
            ...track,
              clips: track.clips.filter((clip) => clip.id !== id)
          })),
            selectedClipId: state.selectedClipId === id ? null : state.selectedClipId
      }));
      triggerAutoSave();
          updateProjectDuration();
        } catch (error) {
          console.error('Error removing clip:', error);
        }
    },

      updateClip: async (id, updates) => {
        try {
          const updatedClip = await TimelineService.updateClip(id, updates);
          if (updatedClip) {
      set((state) => ({
              tracks: state.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) =>
                  clip.id === id ? { ...clip, ...updatedClip } : clip
                )
              }))
      }));
      triggerAutoSave();
            updateProjectDuration();
          }
        } catch (error) {
          console.error('Error updating clip:', error);
        }
    },

    setSelectedClipId: (id) => set({ selectedClipId: id }),

      splitClip: async (clipId, splitTime) => {
        try {
          const result = await TimelineService.splitClip(clipId, splitTime);
          if (result && result.length === 2) {
            const [firstClip, secondClip] = result;
            
            set((state) => ({
              tracks: state.tracks.map((track) => ({
                ...track,
                clips: track.clips
                  .filter((clip) => clip.id !== clipId)
                  .concat([
                    { ...firstClip, effects: [], audioEffects: [], textElements: [], transitions: [], keyframes: [] },
                    { ...secondClip, effects: [], audioEffects: [], textElements: [], transitions: [], keyframes: [] }
                  ])
              })),
              selectedClipId: firstClip.id
            }));
            
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error splitting clip:', error);
        }
      },

      trimClip: async (clipId, trimStart, trimEnd) => {
        await get().updateClip(clipId, { 
          trim_start: trimStart,
          ...(trimEnd && { trim_end: trimEnd })
        });
      },

      moveClip: async (clipId, newTrackId, newStartTime) => {
        const state = get();
        let clipToMove: EnhancedTimelineClip | null = null;
        
        // Find the clip
        for (const track of state.tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) {
            clipToMove = clip;
            break;
          }
        }
        
        if (!clipToMove) return;
        
        const duration = clipToMove.end_time - clipToMove.start_time;
        
        await get().updateClip(clipId, {
          track_id: newTrackId,
          start_time: newStartTime,
          end_time: newStartTime + duration
        });
      },

      duplicateClip: async (clipId) => {
        const state = get();
        let clipToDuplicate: EnhancedTimelineClip | null = null;
        let trackId: string | null = null;
        
        // Find the clip
        for (const track of state.tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) {
            clipToDuplicate = clip;
            trackId = track.id;
            break;
          }
        }
        
        if (!clipToDuplicate || !trackId) return;
        
        const duration = clipToDuplicate.end_time - clipToDuplicate.start_time;
        const newStartTime = clipToDuplicate.end_time + 0.1; // Small gap
        
        await get().addClip(trackId, clipToDuplicate.asset_id, newStartTime, duration);
      },

      // ============================================================================
      // EFFECTS MANAGEMENT ACTIONS
      // ============================================================================

      addClipEffect: async (clipId, effectType, effectName, parameters = {}) => {
        try {
          const effect = await TimelineService.addClipEffect({
            clip_id: clipId,
            effect_type: effectType,
            effect_name: effectName,
            parameters,
            is_enabled: true,
            effect_order: 0
          });
          
          if (effect) {
            set((state) => ({
              tracks: state.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId
                    ? { ...clip, effects: [...(clip.effects || []), effect] }
                    : clip
                )
              }))
            }));
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error adding clip effect:', error);
        }
      },

      removeClipEffect: async (effectId) => {
        // Implementation for removing effects
        triggerAutoSave();
      },

      updateClipEffect: async (effectId, parameters) => {
        // Implementation for updating effects
        triggerAutoSave();
      },

      addAudioEffect: async (clipId, effectType, effectName, parameters = {}) => {
        try {
          const effect = await TimelineService.addAudioEffect({
            clip_id: clipId,
            effect_type: effectType,
            effect_name: effectName,
            parameters,
            is_enabled: true,
            effect_order: 0
          });
          
          if (effect) {
            set((state) => ({
              tracks: state.tracks.map((track) => ({
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId
                    ? { ...clip, audioEffects: [...(clip.audioEffects || []), effect] }
                    : clip
                )
              }))
            }));
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error adding audio effect:', error);
        }
      },

      addTextElement: async (clipId, text, style = {}) => {
        try {
          const textElement = await TimelineService.addTextElement({
            clip_id: clipId,
            text_content: text,
            font_family: style.fontFamily || 'Arial',
            font_size: style.fontSize || 24,
            color: style.color || '#FFFFFF',
            position: style.position || { x: 50, y: 50 },
            size: style.size || { width: 200, height: 100 }
          });
          
          if (textElement) {
            set((state) => ({
              tracks: state.tracks.map((track) => ({
              ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId
                    ? { ...clip, textElements: [...(clip.textElements || []), textElement] }
                    : clip
                )
              }))
            }));
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error adding text element:', error);
        }
      },

      addTransition: async (fromClipId, toClipId, transitionType, duration) => {
        try {
          const transition = await TimelineService.addTransition({
            from_clip_id: fromClipId,
            to_clip_id: toClipId,
            transition_type: transitionType,
            duration,
            easing_function: 'ease-in-out',
            custom_properties: {}
          });
          
          if (transition) {
            triggerAutoSave();
          }
        } catch (error) {
          console.error('Error adding transition:', error);
        }
      },

      // ============================================================================
      // TIMELINE CONTROL ACTIONS
      // ============================================================================

      setTimelineZoom: (zoom) => {
        set({ timelineZoom: zoom });
        triggerTimelineSave();
      },
      
      setTimelineScroll: (scroll) => {
        set({ timelineScroll: scroll });
        triggerTimelineSave();
      },
      
      setSnapToGrid: (snap) => {
        set({ snapToGrid: snap });
        triggerTimelineSave();
      },
      
      setGridSize: (size) => {
        set({ gridSize: size });
        triggerTimelineSave();
      },

      // ============================================================================
      // SELECTION MANAGEMENT ACTIONS
      // ============================================================================

      selectMultipleClips: (clipIds) => {
        set({ selectedKeyframes: clipIds });
      },
      
      clearSelection: () => {
        set({ 
          selectedClipId: null, 
          selectedTrackId: null, 
          selectedMediaId: null, 
          selectedKeyframes: [] 
        });
      },
      
      selectAll: () => {
        const state = get();
        const allClipIds = state.tracks.flatMap(track => track.clips.map(clip => clip.id));
        set({ selectedKeyframes: allClipIds });
      },

      // ============================================================================
      // DIALOG CONTROL ACTIONS
      // ============================================================================

    setProjectDialogOpen: (open) => set({ projectDialogOpen: open }),
    setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
    setKeyDialogOpen: (open) => set({ keyDialogOpen: open }),
      setMediaGalleryOpen: (open) => set({ mediaGalleryOpen: open }),

      // ============================================================================
      // AI GENERATION ACTIONS
      // ============================================================================

    setIsGenerating: (generating) => set({ isGenerating: generating }),
    setGenerationProgress: (progress) => set({ generationProgress: progress }),
      setGenerationStatus: (status) => set({ generationStatus: status }),

      // ============================================================================
      // DEVICE SYNC ACTIONS
      // ============================================================================

      updateDeviceActivity: async () => {
        try {
          await DeviceService.updateDeviceActivity();
          set({ deviceSyncStatus: 'synced' });
      } catch (error) {
          console.error('Error updating device activity:', error);
          set({ deviceSyncStatus: 'offline' });
        }
      },

      checkSyncStatus: async () => {
        try {
          const state = get();
          if (!state.project) return;
          
          const syncStatus = await DeviceService.getProjectSyncStatus(state.project.id);
          set({
            availableDevices: syncStatus.totalDevices,
            deviceSyncStatus: syncStatus.syncedDevices > 0 ? 'synced' : 'syncing'
          });
        } catch (error) {
          console.error('Error checking sync status:', error);
          set({ deviceSyncStatus: 'offline' });
        }
      },

      resolveConflicts: async () => {
        // Implementation for conflict resolution
        set({ deviceSyncStatus: 'synced' });
      },

      // ============================================================================
      // IMPORT/EXPORT ACTIONS
      // ============================================================================

      exportProject: async (format, settings = {}) => {
        const state = get();
        if (!state.project) return;
        
        set({ exportDialogOpen: false });
        // Implementation for project export
      },

      importMedia: async (files) => {
        set({ isLoading: true });
        try {
          for (const file of files) {
            const result = await MediaAssetService.uploadMediaAsset(file);
            if (result.success && result.asset) {
              get().addMediaAsset(result.asset);
            }
          }
      } catch (error) {
          console.error('Error importing media:', error);
        } finally {
          set({ isLoading: false });
      }
    },

      // ============================================================================
      // HISTORY/UNDO ACTIONS
      // ============================================================================

      undo: async () => {
        // Implementation for undo functionality
      },

      redo: async () => {
        // Implementation for redo functionality
      },

      canUndo: () => {
        // Implementation for undo check
        return false;
      },

      canRedo: () => {
        // Implementation for redo check
        return false;
      }
  };
}); 