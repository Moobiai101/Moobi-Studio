import { useVideoProjectStore } from "../providers/video-project-provider";

export function useVideoProject() {
  // Project data
  const project = useVideoProjectStore((state) => state.project);
  
  // Playback state
  const currentTime = useVideoProjectStore((state) => state.currentTime);
  const isPlaying = useVideoProjectStore((state) => state.isPlaying);
  const playbackRate = useVideoProjectStore((state) => state.playbackRate);
  
  // UI state
  const selectedClipId = useVideoProjectStore((state) => state.selectedClipId);
  const selectedTrackId = useVideoProjectStore((state) => state.selectedTrackId);
  const selectedMediaId = useVideoProjectStore((state) => state.selectedMediaId);
  const timelineZoom = useVideoProjectStore((state) => state.timelineZoom);
  const timelineScroll = useVideoProjectStore((state) => state.timelineScroll);
  
  // Dialog states
  const projectDialogOpen = useVideoProjectStore((state) => state.projectDialogOpen);
  const exportDialogOpen = useVideoProjectStore((state) => state.exportDialogOpen);
  const keyDialogOpen = useVideoProjectStore((state) => state.keyDialogOpen);
  
  // AI generation state
  const isGenerating = useVideoProjectStore((state) => state.isGenerating);
  const generationProgress = useVideoProjectStore((state) => state.generationProgress);
  
  // Actions
  const setCurrentTime = useVideoProjectStore((state) => state.setCurrentTime);
  const setIsPlaying = useVideoProjectStore((state) => state.setIsPlaying);
  const setPlaybackRate = useVideoProjectStore((state) => state.setPlaybackRate);
  
  // Media management
  const addMediaAsset = useVideoProjectStore((state) => state.addMediaAsset);
  const removeMediaAsset = useVideoProjectStore((state) => state.removeMediaAsset);
  const setSelectedMediaId = useVideoProjectStore((state) => state.setSelectedMediaId);
  
  // Track management
  const addTrack = useVideoProjectStore((state) => state.addTrack);
  const removeTrack = useVideoProjectStore((state) => state.removeTrack);
  const updateTrack = useVideoProjectStore((state) => state.updateTrack);
  const setSelectedTrackId = useVideoProjectStore((state) => state.setSelectedTrackId);
  
  // Clip management
  const addClip = useVideoProjectStore((state) => state.addClip);
  const removeClip = useVideoProjectStore((state) => state.removeClip);
  const updateClip = useVideoProjectStore((state) => state.updateClip);
  const setSelectedClipId = useVideoProjectStore((state) => state.setSelectedClipId);
  const splitClip = useVideoProjectStore((state) => state.splitClip);
  
  // Timeline controls
  const setTimelineZoom = useVideoProjectStore((state) => state.setTimelineZoom);
  const setTimelineScroll = useVideoProjectStore((state) => state.setTimelineScroll);
  
  // Dialog controls
  const setProjectDialogOpen = useVideoProjectStore((state) => state.setProjectDialogOpen);
  const setExportDialogOpen = useVideoProjectStore((state) => state.setExportDialogOpen);
  const setKeyDialogOpen = useVideoProjectStore((state) => state.setKeyDialogOpen);
  
  // AI generation
  const setIsGenerating = useVideoProjectStore((state) => state.setIsGenerating);
  const setGenerationProgress = useVideoProjectStore((state) => state.setGenerationProgress);
  
  // Project management
  const saveProject = useVideoProjectStore((state) => state.saveProject);
  const loadProject = useVideoProjectStore((state) => state.loadProject);
  const exportProject = useVideoProjectStore((state) => state.exportProject);

  return {
    // Project data
    project,
    
    // Playback state
    currentTime,
    isPlaying,
    playbackRate,
    
    // UI state
    selectedClipId,
    selectedTrackId,
    selectedMediaId,
    timelineZoom,
    timelineScroll,
    
    // Dialog states
    projectDialogOpen,
    exportDialogOpen,
    keyDialogOpen,
    
    // AI generation state
    isGenerating,
    generationProgress,
    
    // Actions
    setCurrentTime,
    setIsPlaying,
    setPlaybackRate,
    
    // Media management
    addMediaAsset,
    removeMediaAsset,
    setSelectedMediaId,
    
    // Track management
    addTrack,
    removeTrack,
    updateTrack,
    setSelectedTrackId,
    
    // Clip management
    addClip,
    removeClip,
    updateClip,
    setSelectedClipId,
    splitClip,
    
    // Timeline controls
    setTimelineZoom,
    setTimelineScroll,
    
    // Dialog controls
    setProjectDialogOpen,
    setExportDialogOpen,
    setKeyDialogOpen,
    
    // AI generation
    setIsGenerating,
    setGenerationProgress,
    
    // Project management
    saveProject,
    loadProject,
    exportProject,
  };
} 