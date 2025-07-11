"use client";

import { createContext, useContext, useRef, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createVideoProjectStore, type VideoProjectStore, type VideoProjectState } from "../store/video-project-store";
import { VideoProjectService } from "@/services/video-projects";
import { MediaAssetService } from "@/services/media-assets";
import { VideoEditorProject } from "@/types/database";
import { VideoProjectList } from "../components/video-project-list";

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
  const [currentProject, setCurrentProject] = useState<VideoEditorProject | null>(null);
  const [showProjectList, setShowProjectList] = useState(!projectId);
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize store and load project
  useEffect(() => {
    const initializeProject = async () => {
      try {
        // Create store for this project
        storeRef.current = createVideoProjectStore({ projectId });
        
        // Initialize the project
        await storeRef.current.getState().initializeProject(projectId);
        
        // Load media assets
        const mediaAssets = await MediaAssetService.getUserAssets();
        
        // Add media assets to the store
        mediaAssets.forEach(asset => {
          storeRef.current?.getState().addMediaAsset(asset);
        });

        // Validate local asset synchronization
        console.log('🔍 Validating local asset synchronization...');
        const validation = await MediaAssetService.validateAndSyncLocalAssets();
        
        if (validation.missing > 0) {
          console.warn(`⚠️ Found ${validation.missing} missing assets in IndexedDB`);
          console.warn('These assets exist in the database but not in local storage. They may need to be re-uploaded.');
        }
        
        if (validation.valid > 0) {
          console.log(`✅ ${validation.valid} assets are properly synchronized`);
        }
        
        setCurrentProject(storeRef.current.getState().project);
      } catch (error) {
        console.error("Failed to initialize project:", error);
        // Fallback to default project
        if (!storeRef.current) {
          storeRef.current = createVideoProjectStore({ projectId: "fallback-project" });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeProject();
  }, [projectId]);
  
  const handleOpenProject = async (project: VideoEditorProject) => {
    setCurrentProject(project);
    setShowProjectList(false);
    setIsLoading(true);
    
    try {
      // Update the store with the new project
      if (storeRef.current) {
        // Load the project data
        await storeRef.current.getState().loadProject(project.id);
        
        // Get current media assets to avoid duplicates
        const currentAssets = storeRef.current.getState().mediaAssets;
        const currentAssetIds = new Set(currentAssets.map(asset => asset.id));
        
        // Load media assets for the video studio
        const allMediaAssets = await MediaAssetService.getUserAssets();
        
        // Only add new assets that aren't already in the store
        const newAssets = allMediaAssets.filter(asset => !currentAssetIds.has(asset.id));
        
        console.log(`🔄 Project load: ${currentAssets.length} existing, ${newAssets.length} new assets to add`);
        
        // Add only new media assets to prevent duplicates
        newAssets.forEach(asset => {
          storeRef.current?.getState().addMediaAsset(asset);
        });
        
        // If we need to replace all assets (e.g., after significant changes), use refreshMediaAssets instead
        // await storeRef.current.getState().refreshMediaAssets();
      }
    } catch (error) {
      console.error("Failed to open project:", error);
    } finally {
      setIsLoading(false);
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