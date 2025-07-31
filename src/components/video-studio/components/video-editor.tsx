"use client";

import { useState, useRef, useEffect } from "react";
import { useVideoProject } from "../hooks/use-video-project";
import { VideoFilmstripsProvider } from "../hooks/use-video-filmstrips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Download,
  Save,
  Sparkles,
  Undo,
  Redo,
  Film,
  Music,
  Image,
  Type,
  ChevronLeft,
  Scissors,
  Wand2,
  FileVideo,
  Upload,
  FolderOpen,
  Settings,
  Plus,
  ImageIcon,
  VideoIcon,
  VolumeX
} from "lucide-react";
import { formatTime } from "../lib/utils";
import { VideoPreview } from "./video-preview";
import { VideoTimeline } from "./video-timeline";
import { VideoExportDialog } from "./video-export-dialog";
import { AIPromptPanel } from "./ai-prompt-panel";
import { toast } from "@/hooks/use-toast";
import { MediaPanel } from "../components/media-panel";
import { OverlayControls } from "./overlay-controls";

export function VideoEditor() {
  const {
    project,
    currentTime,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedClipId,
    addMediaAsset,
    saveProject,
    saveStatus,
    lastSavedAt,
    saveError,
  } = useVideoProject();

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [activeTool, setActiveTool] = useState<string>("select");
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync project name with local state
  useEffect(() => {
    setProjectName(project.name);
  }, [project.name]);

  // Auto-collapse panel on smaller screens
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Auto-collapse if screen width is less than 1280px (xl breakpoint)
      if (width < 1280 && !isRightPanelCollapsed) {
        setIsRightPanelCollapsed(true);
      }
    };

    handleResize(); // Check on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isRightPanelCollapsed]);

  // Update project name when input changes
  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setProjectName(newName);
    // Update the project name in the store (if you have an update function)
    // updateProjectName?.(newName);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleFileUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        const url = URL.createObjectURL(file);
        
        // Determine content type and duration
        let duration_seconds: number | undefined;
        if (file.type.startsWith("image/")) {
          duration_seconds = 5; // Default duration for images
        }

        addMediaAsset({
          user_id: '', // Will be set by the addMediaAsset function
          title: file.name,
          description: '',
          tags: [],
          r2_object_key: url, // Temporary - will be replaced with R2 key
          file_name: file.name,
          content_type: file.type,
          file_size_bytes: file.size,
          source_studio: 'video-studio',
          duration_seconds,
          dimensions: undefined, // Will be set after metadata extraction
          video_metadata: undefined, // Will be set for video files
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        toast({
          title: "File uploaded",
          description: `${file.name} has been added to your project`,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        toast({
          title: "Upload failed",
          description: "Failed to upload file. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const tools = [
    { id: "select", icon: null, label: "Selection Tool" },
    { id: "upload", icon: Upload, label: "Upload Media", action: () => fileInputRef.current?.click() },
    { id: "video", icon: Film, label: "Video" },
    { id: "audio", icon: Music, label: "Audio" },
    { id: "image", icon: Image, label: "Image" },
    { id: "text", icon: Type, label: "Text" },
    { id: "cut", icon: Scissors, label: "Cut Tool" },
    { id: "effects", icon: Wand2, label: "Effects" },
  ];

  // Find selected clip
  const selectedClip = project.tracks
    .flatMap(track => track.clips)
    .find(clip => clip.id === selectedClipId);

  return (
    <div className="h-screen w-full bg-zinc-950 flex flex-col">
      {/* Top Header Bar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white"
            onClick={() => window.history.back()}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          
          <div className="w-px h-6 bg-zinc-700" />
          
          <div className="flex items-center gap-2">
            <FileVideo className="w-4 h-4 text-zinc-500" />
            <Input
              value={projectName}
              onChange={handleProjectNameChange}
              className="bg-transparent border-0 text-white text-sm font-medium focus:ring-0 w-48 h-8"
              placeholder="Untitled Project"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white h-8 px-3"
          >
            <Undo className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white h-8 px-3"
          >
            <Redo className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-6 bg-zinc-700 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={saveProject}
            className="text-zinc-400 hover:text-white h-8 px-3"
            disabled={saveStatus === 'saving'}
          >
            <Save className="w-4 h-4 mr-1" />
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </Button>
          
          {/* **PRODUCTION SAVE STATUS INDICATOR** */}
          <div className="flex items-center ml-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center text-yellow-400 text-xs">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse mr-1" />
                Saving...
              </div>
            )}
            {saveStatus === 'saved' && lastSavedAt && (
              <div className="flex items-center text-green-400 text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1" />
                Saved {new Date(lastSavedAt).toLocaleTimeString()}
              </div>
            )}
            {saveStatus === 'error' && saveError && (
              <div className="flex items-center text-red-400 text-xs">
                <div className="w-2 h-2 bg-red-400 rounded-full mr-1" />
                Save failed: {saveError}
              </div>
            )}
          </div>
          
          <Button
            size="sm"
            onClick={() => setShowExportDialog(true)}
            className="bg-blue-600 text-white hover:bg-blue-700 h-8 px-3"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Left Toolbar */}
        <div className="w-14 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-3 gap-2 shrink-0">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveTool(tool.id);
                tool.action?.();
              }}
              className={cn(
                "w-10 h-10 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800",
                activeTool === tool.id && "bg-zinc-800 text-white"
              )}
              title={tool.label}
            >
              {tool.icon && <tool.icon className="w-5 h-5" />}
              {tool.id === "select" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2v20l6-4.5L14 20l-6-16 14 5.5V2H2z"/>
                </svg>
              )}
            </Button>
          ))}
        </div>

        {/* Media Panel */}
        <MediaPanel />

        {/* Center Preview Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Preview Container */}
          <div className="flex-1 bg-black relative flex items-center justify-center min-h-0">
            <VideoPreview />
            
            {/* Resolution Info */}
            <div className="absolute top-4 right-4 bg-zinc-900/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-zinc-300">
              {project.resolution.width}×{project.resolution.height} • {project.fps}fps
            </div>
          </div>

          {/* Timeline Area with Filmstrip Provider */}
          <div className="h-80 bg-zinc-950 border-t border-zinc-800 shrink-0">
            <VideoFilmstripsProvider>
              <VideoTimeline />
            </VideoFilmstripsProvider>
          </div>

          {/* Overlay Controls */}
          <OverlayControls selectedClip={selectedClip} currentTime={currentTime} />
        </div>

        {/* Right AI Panel */}
        <AIPromptPanel 
          isCollapsed={isRightPanelCollapsed}
          onToggleCollapse={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
        />
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
      />

      {/* Export Dialog */}
      <VideoExportDialog open={showExportDialog} onOpenChange={setShowExportDialog} />
    </div>
  );
} 