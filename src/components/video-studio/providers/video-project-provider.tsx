"use client";

import { createContext, useContext, useRef, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createVideoProjectStore, type VideoProjectStore, type VideoProjectState } from "../store/video-project-store";
import { VideoStudioService } from "@/services/video-studio-service";
import { VideoStudioProject, TimelineData } from "@/types/video-studio-database";
import { VideoProjectList } from "../components/video-project-list";
import { AutoSaveSystem } from "@/lib/auto-save/auto-save-system";

const VideoProjectStoreContext = createContext<VideoProjectStore | null>(null);

interface VideoProjectProviderProps {
  children: ReactNode;
  projectId?: string;
}

export function VideoProjectProvider({ 
  children, 
  projectId 
}: VideoProjectProviderProps) {
  const storeRef = useRef<VideoProjectStore | null>(null);
  const [currentProject, setCurrentProject] = useState<VideoStudioProject | null>(null);
  const [showProjectList, setShowProjectList] = useState(!projectId);
  const [isLoading, setIsLoading] = useState(true);
  const autoSaveRef = useRef<AutoSaveSystem | null>(null);
  
  // Initialize store and load project
  useEffect(() => {
    const initializeProject = async () => {
      setIsLoading(true);
      
      try {
        let project: VideoStudioProject;
        let timelineData: TimelineData;
        
        if (projectId) {
          // Load specific project and its timeline data
          project = await VideoStudioService.getProject(projectId);
          timelineData = await VideoStudioService.getTimelineData(projectId);
        } else {
          // Create or load a default project
          const recentProjects = await VideoStudioService.getUserProjects();
          if (recentProjects.length > 0) {
            project = recentProjects[0]; // Load most recent project
            timelineData = await VideoStudioService.getTimelineData(project.id);
          } else {
            // Create new project
            project = await VideoStudioService.createProject({
              title: "My First Video",
              description: "Welcome to your first video project!",
              resolution_width: 1920,
              resolution_height: 1080,
              fps: 30,
              aspect_ratio: '16:9'
            });
            // Get initial timeline data (should have default tracks)
            timelineData = await VideoStudioService.getTimelineData(project.id);
          }
        }
        
        setCurrentProject(project);
        
        // Initialize store with complete timeline data
                 if (!storeRef.current) {
           storeRef.current = createVideoProjectStore({ 
             projectId: project.id
           });
          
          // Update store with loaded timeline data
          storeRef.current.setState({
            project: {
              id: project.id,
              name: project.title,
              resolution: { 
                width: project.resolution_width, 
                height: project.resolution_height 
              },
              fps: project.fps,
              duration: project.duration_seconds,
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
                    effects: [
                      ...(clip.video_effects || []).map((effect: any) => ({
                        id: effect.id,
                        type: effect.type,
                        params: effect.params || {}
                      })),
                      ...(clip.audio_effects || []).map((effect: any) => ({
                        id: effect.id,
                        type: effect.type,
                        params: effect.params || {}
                      }))
                    ],
                    // Add overlay transform if it exists
                    overlayTransform: clip.overlay_transform || undefined
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
                r2_object_key: asset.fingerprint, // Use fingerprint as key
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
              createdAt: new Date(project.created_at),
              updatedAt: new Date(project.updated_at),
            }
          });
        }
        
        // Initialize auto-save system
        autoSaveRef.current = AutoSaveSystem.getInstance();
        await autoSaveRef.current.initializeProject(project.id, {
          onSaveStart: (projectId) => {
            console.log(`🔄 Auto-save started for project ${projectId}`);
          },
          onSaveSuccess: (projectId, version) => {
            console.log(`✅ Auto-save completed for project ${projectId} (version ${version})`);
          },
          onSaveError: (projectId, error) => {
            console.error(`❌ Auto-save failed for project ${projectId}:`, error);
          },
          onConflictDetected: (projectId, conflict) => {
            console.warn(`⚠️ Conflict detected for project ${projectId}:`, conflict);
            return 'merge'; // Auto-merge conflicts
          },
          onNetworkStatusChange: (isOnline) => {
            console.log(`🌐 Network status changed: ${isOnline ? 'online' : 'offline'}`);
          }
        });
        
        setShowProjectList(false);
      } catch (error) {
        console.error("Failed to initialize project:", error);
        // Fallback to default project
        if (!storeRef.current) {
          storeRef.current = createVideoProjectStore({ 
            projectId: "fallback-project"
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeProject();
  }, [projectId]);
  
  // Cleanup auto-save when component unmounts
  useEffect(() => {
    return () => {
      if (autoSaveRef.current && currentProject) {
        autoSaveRef.current.stopAutoSave(currentProject.id);
      }
    };
  }, [currentProject]);
  
  const handleOpenProject = async (project: VideoStudioProject) => {
    setCurrentProject(project);
    setShowProjectList(false);
    
    try {
      // Load complete timeline data for the selected project
      const timelineData = await VideoStudioService.getTimelineData(project.id);
      
      // Update the store with the new project and timeline data
     if (storeRef.current) {
       storeRef.current.setState({
         project: {
           id: project.id,
           name: project.title,
            resolution: { 
              width: project.resolution_width, 
              height: project.resolution_height 
            },
            fps: project.fps,
            duration: project.duration_seconds,
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
                  effects: [
                    ...(clip.video_effects || []).map((effect: any) => ({
                      id: effect.id,
                      type: effect.type,
                      params: effect.params || {}
                    })),
                    ...(clip.audio_effects || []).map((effect: any) => ({
                      id: effect.id,
                      type: effect.type,
                      params: effect.params || {}
                    }))
                  ],
                  // Add overlay transform if it exists
                  overlayTransform: clip.overlay_transform || undefined
                }))
              ,
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
              r2_object_key: asset.fingerprint, // Use fingerprint as key
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
           createdAt: new Date(project.created_at),
           updatedAt: new Date(project.updated_at),
         }
       });
      }
      
      // Initialize auto-save for the new project
      if (autoSaveRef.current) {
        await autoSaveRef.current.initializeProject(project.id);
      }
    } catch (error) {
      console.error("Failed to load project timeline:", error);
     }
  };
  
  if (isLoading) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading video studio...</p>
        </div>
      </div>
    );
  }
  
  if (showProjectList) {
    return (
      <div className="h-screen w-full bg-zinc-950">
        <VideoProjectList onOpenProject={handleOpenProject} />
      </div>
    );
  }
  
  if (!storeRef.current) {
    return (
      <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Failed to initialize project</p>
          <button 
            onClick={() => setShowProjectList(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Choose Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <VideoProjectStoreContext.Provider value={storeRef.current}>
      {children}
    </VideoProjectStoreContext.Provider>
  );
}

export function useVideoProjectStore<T>(
  selector: (state: VideoProjectState) => T,
): T {
  const videoProjectStoreContext = useContext(VideoProjectStoreContext);

  if (!videoProjectStoreContext) {
    throw new Error(
      "useVideoProjectStore must be used within VideoProjectProvider"
    );
  }

  return useStore(videoProjectStoreContext, selector);
} 