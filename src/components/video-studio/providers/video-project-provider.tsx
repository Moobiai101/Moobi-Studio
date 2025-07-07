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
      setIsLoading(true);
      
      try {
        let project: VideoEditorProject;
        
        if (projectId) {
          // Load specific project
          project = await VideoProjectService.getProject(projectId);
        } else {
          // Create or load a default project
          const recentProjects = await VideoProjectService.getUserProjects();
          if (recentProjects.length > 0) {
            project = recentProjects[0]; // Load most recent project
          } else {
            project = await VideoProjectService.createProject("My First Video");
          }
        }
        
        setCurrentProject(project);
        
        // Initialize the store with the project
        if (!storeRef.current) {
          storeRef.current = createVideoProjectStore({ 
            projectId: project.id
          });
        }
        
        // Load the project data into the store
        await storeRef.current.getState().loadProject(project.id);
        
        // Load media assets for the video studio
        const mediaAssets = await MediaAssetService.getUserAssets();
        
        // Add media assets to the store
        mediaAssets.forEach(asset => {
          storeRef.current?.getState().addMediaAsset(asset);
        });
        
        setShowProjectList(false);
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
        
        // Clear existing media assets and reload from database
        storeRef.current.setState({ 
          mediaAssets: []
        });
        
        // Load media assets for the video studio
        const mediaAssets = await MediaAssetService.getUserAssets();
        
        // Add media assets to the store
        mediaAssets.forEach(asset => {
          storeRef.current?.getState().addMediaAsset(asset);
        });
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