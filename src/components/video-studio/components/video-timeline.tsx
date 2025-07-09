"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useResolvedMediaUrl } from "@/lib/video/media-url-resolver";

// Add CSS for timeline animations
const timelineStyles = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  .timeline-container {
    animation-fill-mode: both;
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('timeline-styles')) {
  const style = document.createElement('style');
  style.id = 'timeline-styles';
  style.textContent = timelineStyles;
  document.head.appendChild(style);
}
import { useVideoProject } from "../hooks/use-video-project";
import { useVideoFilmstripsContext } from "../hooks/use-video-filmstrips";
import { getMediaInfo } from "../store/video-project-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { 
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Plus,
  Music,
  Film,
  Image as ImageIcon,
  Scissors,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Upload,
  Video,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CircleSlash,
} from "lucide-react";
import { formatTime } from "../lib/utils";
import { 
  detectFileType, 
  getMediaDuration, 
  getVideoMetadata, 
  getImageDimensions 
} from "../lib/media-utils";
import { useVideoFilmstrips } from "../hooks/use-video-filmstrips";
import { Slider } from "@/components/ui/slider";
import { audioEngine } from "../lib/audio-engine";

// Video Clip Component with Filmstrip Support
interface VideoClipProps {
  clip: any;
  clipWidth: number;
  clipLeft: number;
  isSelected: boolean;
  isDragging: boolean;
  isResizing: boolean;
  onSelect: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: 'left' | 'right') => void;
}

function VideoClip({
  clip,
  clipWidth,
  clipLeft,
  isSelected,
  isDragging,
  isResizing,
  onSelect,
  onMouseDown,
  onResizeStart
}: VideoClipProps) {
  const filmstripsManager = useVideoFilmstripsContext();
  const [filmstripLoaded, setFilmstripLoaded] = useState(false);
  
  // Production-grade URL resolution for IndexedDB URLs
  const { url: resolvedUrl, isLoading: isResolvingUrl, error: urlError } = useResolvedMediaUrl(clip.asset.url);
  
  // Memoize optimalFrameCount to prevent infinite re-renders
  const optimalFrameCount = useMemo(() => {
    return Math.max(3, Math.min(100, Math.floor(clipWidth / 48)));
  }, [clipWidth]);

  // Memoize filmstrip config to prevent unnecessary re-requests
  const filmstripConfig = useMemo(() => ({
    frameWidth: 96,  // 16:9 aspect ratio at 64px height
    frameHeight: 64, // Fixed height like Premiere Pro
    frameCount: optimalFrameCount,
    quality: 0.95,    // High quality for sharp thumbnails
    layout: 'horizontal' as const,
    sourceStartTime: clip.trim_start, // Start time of the segment within the asset
    sourceDuration: clip.trim_end - clip.trim_start // Duration of the segment from the asset
  }), [optimalFrameCount, clip.trim_start, clip.trim_end]);

  // Request filmstrip for video clips using professional editor standards with debouncing
  useEffect(() => {
    if (clip.asset.type !== 'video' || !resolvedUrl || clipWidth <= 20 || isResolvingUrl || urlError) {
      return;
    }

    // Debounce filmstrip requests to prevent excessive calls
    const timeoutId = setTimeout(() => {
      const clipDuration = clip.end_time - clip.start_time;
      
      // Request filmstrip with resolved URL (production-grade approach)
      filmstripsManager.requestFilmstrip(
        clip.id,
        resolvedUrl, // Use resolved URL instead of original
        clipDuration, // This is the display duration on the timeline
        clipWidth,
        {
          priority: isSelected ? 'high' : 'normal',
          config: filmstripConfig
        }
      );
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [clip.id, resolvedUrl, clip.asset.type, clipWidth, isSelected, clip.end_time, clip.start_time, filmstripsManager, filmstripConfig, isResolvingUrl, urlError]);
  
  // Get filmstrip state
  const filmstrip = filmstripsManager.getFilmstrip(clip.id);
  const isLoadingFilmstrip = filmstripsManager.isLoadingFilmstrip(clip.id);
  
  // Update loaded state
  useEffect(() => {
    setFilmstripLoaded(!!filmstrip);
  }, [filmstrip]);
  
  // Calculate background styles for filmstrip with URL resolution handling
  const backgroundStyles: React.CSSProperties = {};
  
  if (clip.asset.type === 'video' && filmstrip) {
    // Professional video editor technique: High-quality filmstrip without over-stretching
    backgroundStyles.backgroundImage = `url(${filmstrip})`;
    backgroundStyles.backgroundSize = 'auto 100%'; // Maintain aspect ratio, fill height only
    backgroundStyles.backgroundPosition = 'left center';
    backgroundStyles.backgroundRepeat = 'repeat-x'; // Repeat horizontally to fill clip width
    // Add image rendering for crisp display
    backgroundStyles.imageRendering = 'crisp-edges';
  } else if (clip.asset.type === 'video') {
    // Loading or fallback state (including URL resolution)
    const isLoading = isLoadingFilmstrip || isResolvingUrl;
    const hasError = urlError;
    
    if (hasError) {
      backgroundStyles.backgroundColor = '#dc2626'; // Red for errors
      backgroundStyles.backgroundImage = 'linear-gradient(45deg, #dc2626 25%, #ef4444 25%, #ef4444 50%, #dc2626 50%, #dc2626 75%, #ef4444 75%)';
      backgroundStyles.backgroundSize = '8px 8px';
    } else {
      backgroundStyles.backgroundColor = isLoading ? '#3b82f6' : '#1e40af';
      backgroundStyles.backgroundImage = isLoading 
        ? 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #3b82f6 100%)'
        : undefined;
      backgroundStyles.backgroundSize = isLoading ? '200% 100%' : undefined;
      backgroundStyles.animation = isLoading ? 'shimmer 2s infinite linear' : undefined;
    }
  } else if (clip.asset.type === 'image') {
    // Show actual image thumbnail with resolved URL
    backgroundStyles.backgroundImage = `url(${resolvedUrl || clip.asset.url})`;
    backgroundStyles.backgroundSize = 'auto 100%'; // Height fills clip, width maintains aspect ratio
    backgroundStyles.backgroundPosition = 'left center';
    backgroundStyles.backgroundRepeat = 'repeat-x'; // Repeat horizontally for long clips
  }
  
  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded cursor-move transition-all group overflow-hidden",
        "border-2 hover:border-blue-400",
        isSelected ? "border-blue-500 ring-1 ring-blue-500/50" : "border-transparent",
        isDragging && "opacity-75 scale-105",
        isResizing && "ring-2 ring-yellow-400/50"
      )}
      style={{
        left: `${clipLeft}px`,
        width: `${Math.max(clipWidth, 20)}px`,
        ...backgroundStyles
      }}
      data-clip-id={clip.id}
      onClick={onSelect}
      onMouseDown={onMouseDown}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-blue-300/70 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-blue-200 transition-all z-10 rounded-l"
        data-resize-handle="left"
        onMouseDown={(e) => onResizeStart(e, 'left')}
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Clip content overlay */}
      <div className="h-full flex items-center justify-center pointer-events-none relative z-5">
        {/* Purple tint overlay for image clips */}
        {clip.asset.type === 'image' && (
          <div className="absolute inset-0 bg-purple-500/20 rounded"></div>
        )}
        
        {/* Loading indicator for filmstrip and URL resolution */}
        {clip.asset.type === 'video' && (isLoadingFilmstrip || isResolvingUrl) && !filmstrip && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-600/20">
            <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Error indicator for URL resolution */}
        {clip.asset.type === 'video' && urlError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-600/20">
            <div className="text-xs text-white/80 text-center px-1">
              URL Error
            </div>
          </div>
        )}
        
        {/* Icon overlay for identification */}
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-opacity",
          (clip.asset.type === 'video' && filmstrip) || clip.asset.type === 'image' 
            ? "bg-black/40 backdrop-blur-sm" 
            : "bg-white/20"
        )}>
          {clip.asset.type === 'video' && <Film className="w-3 h-3 text-white/80" />}
          {clip.asset.type === 'image' && <ImageIcon className="w-3 h-3 text-white/80" />}
        </div>
        
        {/* Clip name overlay for larger clips */}
        {clipWidth > 100 && (
          <div className="absolute bottom-1 left-1 right-1 text-xs text-white/80 truncate bg-black/40 px-1 rounded">
            {clip.asset.title}
          </div>
        )}
        
        {/* Mute indicator */}
        {clip.is_muted && (
          <div className="absolute top-1 left-1 bg-red-600 text-white rounded px-1 text-xs flex items-center gap-1">
            <VolumeX className="w-2 h-2" />
            M
          </div>
        )}
      </div>
      
      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-blue-300/70 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-blue-200 transition-all z-10 rounded-r"
        data-resize-handle="right"
        onMouseDown={(e) => onResizeStart(e, 'right')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Audio Clip Component (simplified, no filmstrip needed)
interface AudioClipProps {
  clip: any;
  clipWidth: number;
  clipLeft: number;
  isSelected: boolean;
  isDragging: boolean;
  isResizing: boolean;
  onSelect: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: 'left' | 'right') => void;
}

// Overlay clip component for overlay track
interface OverlayClipProps {
  clip: any;
  clipWidth: number;
  clipLeft: number;
  isSelected: boolean;
  isDragging: boolean;
  isResizing: boolean;
  onSelect: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: 'left' | 'right') => void;
}

function OverlayClip({
  clip,
  clipWidth,
  clipLeft,
  isSelected,
  isDragging,
  isResizing,
  onSelect,
  onMouseDown,
  onResizeStart
}: OverlayClipProps) {
  const filmstripsManager = useVideoFilmstripsContext();
  const [filmstripLoaded, setFilmstripLoaded] = useState(false);
  
  // Production-grade URL resolution for IndexedDB URLs
  const { url: resolvedUrl, isLoading: isResolvingUrl, error: urlError } = useResolvedMediaUrl(clip.asset.url);
  
  // Memoize optimalFrameCount to prevent infinite re-renders
  const optimalFrameCount = useMemo(() => {
    return Math.max(3, Math.min(100, Math.floor(clipWidth / 48)));
  }, [clipWidth]);

  // Memoize filmstrip config to prevent unnecessary re-requests
  const filmstripConfig = useMemo(() => ({
    frameWidth: 96,  // 16:9 aspect ratio at 64px height
    frameHeight: 64, // Fixed height like Premiere Pro
    frameCount: optimalFrameCount,
    quality: 0.95,    // High quality for sharp thumbnails
    layout: 'horizontal' as const,
    sourceStartTime: clip.trim_start, // Start time of the segment within the asset
    sourceDuration: clip.trim_end - clip.trim_start // Duration of the segment from the asset
  }), [optimalFrameCount, clip.trim_start, clip.trim_end]);

  // Request filmstrip for video overlays using professional editor standards with debouncing
  useEffect(() => {
    if (clip.asset.type !== 'video' || !resolvedUrl || clipWidth <= 20 || isResolvingUrl || urlError) {
      return;
    }

    // Debounce filmstrip requests to prevent excessive calls
    const timeoutId = setTimeout(() => {
      const clipDuration = clip.end_time - clip.start_time;
      
      // Request filmstrip with resolved URL (production-grade approach)
      filmstripsManager.requestFilmstrip(
        clip.id,
        resolvedUrl, // Use resolved URL instead of original
        clipDuration, // This is the display duration on the timeline
        clipWidth,
        {
          priority: isSelected ? 'high' : 'normal',
          config: filmstripConfig
        }
      );
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [clip.id, resolvedUrl, clip.asset.type, clipWidth, isSelected, clip.end_time, clip.start_time, filmstripsManager, filmstripConfig, isResolvingUrl, urlError]);
  
  // Get filmstrip state
  const filmstrip = filmstripsManager.getFilmstrip(clip.id);
  const isLoadingFilmstrip = filmstripsManager.isLoadingFilmstrip(clip.id);
  
  // Update loaded state
  useEffect(() => {
    setFilmstripLoaded(!!filmstrip);
  }, [filmstrip]);

  const duration = clip.end_time - clip.start_time;
  const trimDuration = clip.trim_end - clip.trim_start;
  const opacity = clip.track?.opacity || 1;

  // Calculate background styles for filmstrip (same approach as VideoClip)
  const backgroundStyles: React.CSSProperties = {};
  
  if (clip.asset.type === 'video' && filmstrip) {
    // Professional video editor technique: High-quality filmstrip without over-stretching
    backgroundStyles.backgroundImage = `url(${filmstrip})`;
    backgroundStyles.backgroundSize = 'auto 100%'; // Maintain aspect ratio, fill height only
    backgroundStyles.backgroundPosition = 'left center';
    backgroundStyles.backgroundRepeat = 'repeat-x'; // Repeat horizontally to fill clip width
    // Add image rendering for crisp display
    backgroundStyles.imageRendering = 'crisp-edges';
  } else if (clip.asset.type === 'video') {
    // Loading or fallback state for videos
    backgroundStyles.backgroundColor = isLoadingFilmstrip ? '#7c3aed' : '#6d28d9';
    backgroundStyles.backgroundImage = isLoadingFilmstrip 
      ? 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 50%, #7c3aed 100%)'
      : 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)';
    backgroundStyles.backgroundSize = isLoadingFilmstrip ? '200% 100%' : undefined;
    backgroundStyles.animation = isLoadingFilmstrip ? 'shimmer 2s infinite linear' : undefined;
  } else if (clip.asset.type === 'image') {
    // Show actual image thumbnail with consistent sizing
    backgroundStyles.backgroundImage = `url(${clip.asset.url})`;
    backgroundStyles.backgroundSize = 'auto 100%'; // Height fills clip, width maintains aspect ratio
    backgroundStyles.backgroundPosition = 'left center';
    backgroundStyles.backgroundRepeat = 'repeat-x'; // Repeat horizontally for long clips
  } else {
    // Default gradient fallback
    backgroundStyles.background = 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)';
  }

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded cursor-move transition-all group overflow-hidden",
        "border-2 hover:border-purple-400",
        isSelected ? "border-purple-500 ring-1 ring-purple-500/50" : "border-transparent",
        isDragging && "opacity-75 scale-105",
        isResizing && "ring-2 ring-yellow-400/50"
      )}
      style={{
        left: `${clipLeft}px`,
        width: `${Math.max(clipWidth, 20)}px`,
        opacity: opacity,
        ...backgroundStyles
      }}
      data-clip-id={clip.id}
      onClick={onSelect}
      onMouseDown={onMouseDown}
    >
      {/* Purple tint overlay for overlay clips to distinguish from main clips */}
      <div className="absolute inset-0 bg-purple-500/20 rounded"></div>
      
      {/* Loading indicator for filmstrip */}
      {clip.asset.type === 'video' && isLoadingFilmstrip && !filmstrip && (
        <div className="absolute inset-0 flex items-center justify-center bg-purple-600/20">
          <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Clip content overlay */}
      <div className="h-full flex items-center justify-center pointer-events-none relative z-5">
        {/* Icon overlay for identification */}
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-opacity",
          (clip.asset.type === 'video' && filmstrip) || clip.asset.type === 'image' 
            ? "bg-black/40 backdrop-blur-sm" 
            : "bg-white/20"
        )}>
          <Layers className="w-3 h-3 text-white/80" />
        </div>
        
        {/* Clip name overlay for larger clips */}
        {clipWidth > 100 && (
          <div className="absolute bottom-1 left-1 right-1 text-xs text-white/80 truncate bg-black/40 px-1 rounded">
            {clip.asset.title}
          </div>
        )}
        
        {/* Overlay-specific info */}
        {clipWidth > 80 && (
          <div className="absolute top-1 right-1 flex items-center gap-1">
            {clip.track?.blendMode !== 'normal' && (
              <span className="text-xs bg-purple-600/60 text-white rounded px-1">
                {clip.track.blendMode}
              </span>
            )}
            {opacity < 1 && (
              <span className="text-xs bg-purple-600/60 text-white rounded px-1">
                {Math.round(opacity * 100)}%
              </span>
            )}
          </div>
        )}
        
        {/* Mute indicator */}
        {clip.is_muted && (
          <div className="absolute top-1 left-1 bg-red-600 text-white rounded px-1 text-xs flex items-center gap-1">
            <VolumeX className="w-2 h-2" />
            M
          </div>
        )}
      </div>

      {/* Resize handles - similar to video clips */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-purple-300/70 opacity-0 hover:opacity-100 hover:bg-purple-200 transition-all z-10 rounded-l group-hover:opacity-100"
        data-resize-handle="left"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(e, 'left');
        }}
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-purple-300/70 opacity-0 hover:opacity-100 hover:bg-purple-200 transition-all z-10 rounded-r group-hover:opacity-100"
        data-resize-handle="right"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(e, 'right');
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function AudioClip({
  clip,
  clipWidth,
  clipLeft,
  isSelected,
  isDragging,
  isResizing,
  onSelect,
  onMouseDown,
  onResizeStart
}: AudioClipProps) {
  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded cursor-move transition-all group",
        "border-2 hover:border-green-400",
        isSelected ? "border-green-500 ring-1 ring-green-500/50" : "border-transparent",
        "bg-green-600",
        isDragging && "opacity-75 scale-105",
        isResizing && "ring-2 ring-yellow-400/50"
      )}
      style={{
        left: `${clipLeft}px`,
        width: `${Math.max(clipWidth, 20)}px`,
      }}
      data-clip-id={clip.id}
      onClick={onSelect}
      onMouseDown={onMouseDown}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize bg-green-300/70 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-green-200 transition-all z-10 rounded-l"
        data-resize-handle="left"
        onMouseDown={(e) => onResizeStart(e, 'left')}
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Audio waveform simulation */}
      <div className="h-full flex items-center justify-center px-1 pointer-events-none relative">
        <div className="flex items-center h-4 gap-px">
          {Array.from({ length: Math.min(8, Math.floor(clipWidth * 0.1)) }, (_, i) => (
            <div
              key={i}
              className="w-0.5 bg-white/60 rounded-full"
              style={{ height: `${Math.random() * 70 + 30}%` }}
            />
          ))}
        </div>
        
        {/* Mute indicator */}
        {clip.is_muted && (
          <div className="absolute top-1 left-1 bg-red-600 text-white rounded px-1 text-xs flex items-center gap-1">
            <VolumeX className="w-2 h-2" />
            M
          </div>
        )}
      </div>
    
      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize bg-green-300/70 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-green-200 transition-all z-10 rounded-r"
        data-resize-handle="right"
        onMouseDown={(e) => onResizeStart(e, 'right')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function VideoTimeline() {
  const {
    project,
    tracks,
    mediaAssets,
    currentTime,
    setCurrentTime,
    selectedClipId,
    setSelectedClipId,
    addClip,
    updateClip,
    removeClip,
    isPlaying,
    setIsPlaying,
    addMediaAsset,
    splitClip,
  } = useVideoProject();

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingClip, setIsDraggingClip] = useState(false);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragMovementDirection, setDragMovementDirection] = useState<'left' | 'right' | null>(null);
  const [dragSpeed, setDragSpeed] = useState(0); // 0-100 scale
  const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);
  const [timelineScale, setTimelineScale] = useState(1);
  
  // Timeline scrolling state - key for CapCut-style behavior
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);
  
  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'left' | 'right' | null>(null);
  const [resizingClipId, setResizingClipId] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartTime, setResizeStartTime] = useState(0);

  // Auto-scroll state for professional timeline navigation
  const [autoScrollDirection, setAutoScrollDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const autoScrollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Professional jog/shuttle controls state
  const [isJogging, setIsJogging] = useState(false);
  const [jogDirection, setJogDirection] = useState<'left' | 'right' | null>(null);
  const jogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const jogSpeedRef = useRef<number>(1); // Multiplier for jog speed

  // Professional Volume Controls (Pro Tools style)
  const [masterVolume, setMasterVolume] = useState(1.0); // 0.0 to 1.0
  const [isMasterMuted, setIsMasterMuted] = useState(false);
  
  // Constants for CapCut-style timeline
  const PIXELS_PER_SECOND = 50 * timelineScale;
  const TIMELINE_PADDING = 1000;
  const PLAYHEAD_POSITION = 400;
  
  // Auto-scroll constants
  const AUTO_SCROLL_ZONE = 80; // Increased from 50px to 80px for better detection
  const AUTO_SCROLL_SPEED_BASE = 3; // Reduced from 12 to 3 for finer control
  const AUTO_SCROLL_SPEED_MAX = 10; // Reduced from 40 to 10 for maximum speed
  const AUTO_SCROLL_INTERVAL = 16; // ~60fps for smooth scrolling
  const AUTO_SCROLL_ACCELERATION = 1.05; // Reduced from 1.5 to 1.05 for gentler acceleration
  
  // Frame-specific constants
  const FRAME_RATE = 30; // Frames per second
  const FRAME_DURATION = 1 / FRAME_RATE; // Duration of one frame in seconds

  // URL resolution cache for audio engine
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string>>(new Map());
  
  // Debug mediaAssets immediately
  console.log('🔍 VideoTimeline render - mediaAssets:', mediaAssets.length, mediaAssets.map(a => ({ id: a.id, localId: a.local_asset_id })));
  
  // Pre-resolve all IndexedDB URLs for audio playback
  useEffect(() => {
    console.log('🔍 URL resolution effect triggered. MediaAssets length:', mediaAssets.length);
    console.log('🔍 MediaAssets:', mediaAssets.map(a => ({ id: a.id, hasLocalId: !!a.local_asset_id, localId: a.local_asset_id })));
    
    const resolveAllUrls = async () => {
      console.log('🔄 Starting URL resolution for media assets:', mediaAssets.length);
      
      const urlsToResolve: { id: string; url: string }[] = [];
      
      // Collect all IndexedDB URLs from media assets
      mediaAssets.forEach(asset => {
        if (asset.local_asset_id) {
          const indexedDbUrl = `indexeddb://${asset.local_asset_id}`;
          urlsToResolve.push({ id: asset.id, url: indexedDbUrl });
          console.log('📋 Found local asset to resolve:', { id: asset.id, url: indexedDbUrl });
        }
      });
      
      if (urlsToResolve.length === 0) {
        console.log('✅ No IndexedDB URLs to resolve');
        setResolvedUrls(new Map());
        return;
      }
      
      console.log('🔄 Resolving', urlsToResolve.length, 'IndexedDB URLs...');
      
      try {
        // Resolve all URLs in parallel
        const { MediaUrlResolver } = await import('@/lib/video/media-url-resolver');
        const newResolvedUrls = new Map<string, string>();
        
        const resolutionPromises = urlsToResolve.map(async ({ id, url }) => {
          try {
            console.log('🔄 Resolving URL for asset', id, ':', url);
            const resolvedUrl = await MediaUrlResolver.resolveUrl(url);
            newResolvedUrls.set(id, resolvedUrl);
            console.log('✅ Pre-resolved URL for asset', id, ':', url, '->', resolvedUrl);
            return { id, success: true, resolvedUrl };
          } catch (error) {
            console.error('❌ Failed to pre-resolve URL for asset', id, ':', error);
            // Store original URL as fallback
            newResolvedUrls.set(id, url);
            return { id, success: false, error };
          }
        });
        
        const results = await Promise.all(resolutionPromises);
        console.log('🎵 URL resolution results:', results);
        console.log('🎵 URL resolution complete. Resolved URLs:', newResolvedUrls.size);
        setResolvedUrls(newResolvedUrls);
      } catch (importError) {
        console.error('❌ Failed to import MediaUrlResolver:', importError);
        setResolvedUrls(new Map());
      }
    };
    
    resolveAllUrls().catch(error => {
      console.error('❌ URL resolution failed:', error);
      setResolvedUrls(new Map());
    });
  }, [mediaAssets]);
  
  // Enhanced getAllClips that includes resolved URLs
  const getAllClips = () => {
    const allClips: any[] = [];
    
    tracks.forEach((track: any) => {
      track.clips.forEach((clip: any) => {
        const asset = mediaAssets.find((a: any) => a.id === clip.asset_id);
        if (asset) {
          const mediaInfo = getMediaInfo(asset);
          const originalUrl = mediaInfo.url;
          
          // Use resolved URL if available, otherwise use original
          const resolvedUrl = resolvedUrls.get(asset.id);
          if (resolvedUrl) {
            mediaInfo.url = resolvedUrl;
            console.log('🔄 URL replacement in getAllClips:', {
              assetId: asset.id,
              originalUrl,
              resolvedUrl,
              hasLocalAssetId: !!asset.local_asset_id
            });
          } else if (asset.local_asset_id) {
            console.warn('⚠️ No resolved URL found for local asset:', {
              assetId: asset.id,
              localAssetId: asset.local_asset_id,
              originalUrl,
              availableResolvedUrls: Array.from(resolvedUrls.keys())
            });
          }
          
          allClips.push({
            ...clip,
            asset: {
              ...asset,
              ...mediaInfo // Add extracted media info with resolved URL
            },
            trackType: track.track_type
          });
        }
      });
    });
    
    return allClips.sort((a: any, b: any) => a.start_time - b.start_time);
  };

  // Group clips by track type
  const getClipsByTrack = () => {
    const trackGroups: { [key: string]: any[] } = {
      overlay: [],
      video: [],
      audio: []
    };
    
    tracks.forEach((track: any) => {
      track.clips.forEach((clip: any) => {
        const asset = mediaAssets.find((a: any) => a.id === clip.asset_id);
        if (asset) {
          const mediaInfo = getMediaInfo(asset);
          
          // Use resolved URL if available, otherwise use original
          const resolvedUrl = resolvedUrls.get(asset.id);
          if (resolvedUrl) {
            mediaInfo.url = resolvedUrl;
          }
          
          const clipWithAsset = {
            ...clip,
            asset: {
              ...asset,
              ...mediaInfo // Add extracted media info with resolved URL
            },
            trackType: track.track_type,
            trackId: track.id,
            track: track // Include track info for overlay properties
          };
          
          if (track.track_type === 'audio') {
            trackGroups.audio.push(clipWithAsset);
          } else if (track.track_type === 'overlay') {
            trackGroups.overlay.push(clipWithAsset);
          } else {
            trackGroups.video.push(clipWithAsset);
          }
        }
      });
    });
    
    Object.keys(trackGroups).forEach(key => {
      trackGroups[key].sort((a: any, b: any) => a.start_time - b.start_time);
    });
    
    return trackGroups;
  };

  const clips = getAllClips();
  const clipsByTrack = getClipsByTrack();
  const selectedClip = clips.find(clip => clip.id === selectedClipId);
  
  // Calculate total project duration
  const calculateProjectDuration = () => {
    let maxEndTime = 0;
    tracks.forEach((track: any) => {
      track.clips.forEach((clip: any) => {
        maxEndTime = Math.max(maxEndTime, clip.end_time);
      });
    });
    return Math.max(maxEndTime, 30); // Minimum 30 seconds for better UX
  };

  const totalDuration = calculateProjectDuration();
  const timelineWidth = totalDuration * PIXELS_PER_SECOND + (TIMELINE_PADDING * 2);
  
  // Check if selected clip can be split at current playhead position
  const canSplitSelectedClip = selectedClip && 
    currentTime > selectedClip.startTime && 
    currentTime < selectedClip.endTime;

  // Update timeline offset when currentTime changes (CapCut-style scrolling)
  useEffect(() => {
    const targetOffset = (currentTime * PIXELS_PER_SECOND) - PLAYHEAD_POSITION + TIMELINE_PADDING;
    setTimelineOffset(targetOffset);
  }, [currentTime, PIXELS_PER_SECOND]);

  // Auto-scroll functionality for professional timeline navigation
  const startAutoScroll = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
    
    setAutoScrollDirection(direction);
    
    // Track scroll speed with closure for dynamic adjustment
    let currentScrollSpeed = AUTO_SCROLL_SPEED_BASE;
    let scrollDuration = 0;
    
    const scroll = () => {
      // Increase scroll speed over time for better UX (like professional editors)
      scrollDuration += AUTO_SCROLL_INTERVAL;
      
      // Longer delay before acceleration (1.5 seconds instead of 0.5)
      if (scrollDuration > 1500) { 
        // More gradual acceleration curve
        const accelerationFactor = Math.min(
          1.0 + (scrollDuration - 1500) / 5000, // Very gentle acceleration that maxes out after ~5 seconds
          AUTO_SCROLL_ACCELERATION
        );
        
        currentScrollSpeed = Math.min(
          AUTO_SCROLL_SPEED_MAX, 
          currentScrollSpeed * accelerationFactor
        );
      }
      
      if (direction === 'left') {
        setTimelineOffset(prev => Math.max(0, prev - currentScrollSpeed));
      } else if (direction === 'right') {
        setTimelineOffset(prev => prev + currentScrollSpeed);
      } else if (direction === 'up') {
        setVerticalOffset(prev => Math.max(0, prev - currentScrollSpeed));
      } else if (direction === 'down') {
        setVerticalOffset(prev => prev + currentScrollSpeed);
      }
    };
    
    // Start scrolling immediately, then continue at intervals
    scroll();
    autoScrollRef.current = setInterval(scroll, AUTO_SCROLL_INTERVAL);
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
    setAutoScrollDirection(null);
  };

  const checkAutoScroll = (mouseX: number, mouseY: number) => {
    if (!timelineContainerRef.current) return;
    
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const relativeX = mouseX - rect.left;
    const relativeY = mouseY - rect.top;
    
    let newDirection: 'left' | 'right' | 'up' | 'down' | null = null;
    
    // Calculate distance from edges for variable speed scrolling
    const distanceFromLeft = relativeX;
    const distanceFromRight = rect.width - relativeX;
    const distanceFromTop = relativeY;
    const distanceFromBottom = rect.height - relativeY;
    
    // Check horizontal auto-scroll zones with improved detection
    if (distanceFromLeft < AUTO_SCROLL_ZONE && timelineOffset > 0) {
      newDirection = 'left';
    } else if (distanceFromRight < AUTO_SCROLL_ZONE) {
      newDirection = 'right';
    }
    // Check vertical auto-scroll zones with improved detection
    else if (distanceFromTop < AUTO_SCROLL_ZONE && verticalOffset > 0) {
      newDirection = 'up';
    } else if (distanceFromBottom < AUTO_SCROLL_ZONE) {
      newDirection = 'down';
    }
    
    // Update auto-scroll if direction changed
    if (newDirection !== autoScrollDirection) {
      stopAutoScroll();
      if (newDirection) {
        startAutoScroll(newDirection);
      }
    }
  };

  // Professional jog/shuttle controls (like Premiere Pro)
  const startJogging = (direction: 'left' | 'right', speed: number = 1) => {
    if (jogIntervalRef.current) return; // Already jogging
    
    setIsJogging(true);
    setJogDirection(direction);
    jogSpeedRef.current = speed;
    
    const jogStep = () => {
      const frameStep = (1/30) * jogSpeedRef.current; // 30fps frame stepping
      const newTime = direction === 'right' 
        ? Math.min(totalDuration, currentTime + frameStep)
        : Math.max(0, currentTime - frameStep);
      
      setCurrentTime(newTime);
      
      // Accelerate jog speed for holding (like professional editors)
      if (jogSpeedRef.current < 10) {
        jogSpeedRef.current *= 1.1; // Gradually increase speed
      }
    };
    
    // Start jogging immediately, then continue at intervals
    jogStep();
    jogIntervalRef.current = setInterval(jogStep, 50); // 20fps jog rate
  };

  const stopJogging = () => {
    if (jogIntervalRef.current) {
      clearInterval(jogIntervalRef.current);
      jogIntervalRef.current = null;
    }
    setIsJogging(false);
    setJogDirection(null);
    jogSpeedRef.current = 1; // Reset speed
  };

  // Enhanced step frame function for more precise frame movement
  const stepFrame = (direction: 'left' | 'right', frameCount: number = 1) => {
    const frameStep = FRAME_DURATION * frameCount;
    const newTime = direction === 'left'
      ? Math.max(0, currentTime - frameStep)
      : Math.min(totalDuration, currentTime + frameStep);
    
    // Ensure we land exactly on a frame boundary
    const frameSnappedTime = Math.round(newTime * FRAME_RATE) / FRAME_RATE;
    setCurrentTime(frameSnappedTime);
  };

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard if user is typing in an input field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      
      // Enhanced JKL-style navigation (professional editor controls)
      switch (e.key.toLowerCase()) {
        case 'j': // Backward playback (J)
          e.preventDefault();
          
          if (e.shiftKey) {
            // Shift+J: Move backward by 5 frames
            stepFrame('left', 5);
          } else {
            // Regular J: Reverse playback or step backward
            if (isPlaying) {
              // If already playing, don't change mode - step backward
              stepFrame('left', 1);
            } else {
              // Move backward by 1 frame (used as primary scrubbing)
              stepFrame('left', 1);
            }
          }
          break;
        
        case 'k': // Stop/Pause (K)
          e.preventDefault();
          setIsPlaying(false);
          break;
        
        case 'l': // Forward playback (L)
          e.preventDefault();
          
          if (e.shiftKey) {
            // Shift+L: Move forward by 5 frames
            stepFrame('right', 5);
          } else {
            // Regular L: Start playback or step forward
            if (isPlaying) {
              // If already playing, don't change mode - step forward
              stepFrame('right', 1);
            } else {
              // Move forward by 1 frame (used as primary scrubbing)
              stepFrame('right', 1);
            }
          }
          break;
        
        case ' ': // Spacebar for play/pause toggle
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        
        case 'arrowleft': // Left arrow for frame-by-frame movement
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Left: Jump to previous clip start
            // Find the nearest clip start before current time
            const prevClipStart = Math.max(
              0,
              ...clips
                .filter(clip => clip.startTime < currentTime)
                .map(clip => clip.startTime)
            );
            setCurrentTime(prevClipStart);
          } else if (e.shiftKey) {
            // Shift+Left: Move backward by 1 second
            setCurrentTime(Math.max(0, currentTime - 1));
          } else if (e.altKey) {
            // Alt+Left: Move backward by 10 frames
            stepFrame('left', 10);
          } else {
            // Regular Left: Move backward by 1 frame
            stepFrame('left', 1);
          }
          break;
        
        case 'arrowright': // Right arrow for frame-by-frame movement
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Right: Jump to next clip start
            // Find the nearest clip start after current time
            const nextClipStart = Math.min(
              totalDuration,
              ...clips
                .filter(clip => clip.startTime > currentTime)
                .map(clip => clip.startTime)
                .concat(totalDuration)
            );
            setCurrentTime(nextClipStart);
          } else if (e.shiftKey) {
            // Shift+Right: Move forward by 1 second
            setCurrentTime(Math.min(totalDuration, currentTime + 1));
          } else if (e.altKey) {
            // Alt+Right: Move forward by 10 frames
            stepFrame('right', 10);
          } else {
            // Regular Right: Move forward by 1 frame
            stepFrame('right', 1);
          }
          break;
          
        case 'home': // Jump to start
          e.preventDefault();
          setCurrentTime(0);
          break;
          
        case 'end': // Jump to end
          e.preventDefault();
          setCurrentTime(totalDuration);
          break;
          
        case 's': // Split clip
          if (canSplitSelectedClip && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleSplitClip();
          }
          break;
          
        case 'delete': // Delete selected clip
        case 'backspace': // Alternative delete key
          if (selectedClip && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleDeleteClip();
          }
          break;
          
        case 'd': // Duplicate selected clip
          if (selectedClip && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();
            handleDuplicateClip();
          }
          break;
          
        case 'm': // Mute toggle (Pro Tools style)
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            if (selectedClip) {
              handleClipMuteToggle();
            } else {
              handleMasterMuteToggle();
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTime, totalDuration, isPlaying, clips, canSplitSelectedClip, selectedClip, FRAME_DURATION, FRAME_RATE]);

  // Cleanup auto-scroll and jog controls on unmount
  useEffect(() => {
    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
      if (jogIntervalRef.current) {
        clearInterval(jogIntervalRef.current);
      }
      // Don't destroy audio engine here as it's a singleton used across the app
    };
  }, []);

  // ===== PROFESSIONAL AUDIO ENGINE INTEGRATION =====
  // Using Web Audio API for professional-grade audio control with:
  // - Frame-accurate playback synchronization like Remotion
  // - Logarithmic volume scaling (Pro Tools/Logic style)
  // - Real muting (not just visual state)
  // - Multi-track mixing with master controls
  // - Automatic track management based on timeline clips

  // Sync audio tracks with timeline clips - only when URLs are resolved
  useEffect(() => {
    // Skip if no media assets or URLs not yet resolved
    if (mediaAssets.length === 0) return;
    
    // Check if all local assets have been resolved
    const localAssets = mediaAssets.filter(asset => asset.local_asset_id);
    const allResolved = localAssets.length === 0 || localAssets.every(asset => resolvedUrls.has(asset.id));
    
    if (!allResolved) {
      console.log('🔄 Waiting for URL resolution to complete...');
      return;
    }
    
    console.log('🎵 URL resolution complete, syncing audio tracks...', {
      totalAssets: mediaAssets.length,
      localAssets: localAssets.length,
      resolvedUrls: resolvedUrls.size
    });
    
    const timelineClips = getAllClips();
    
    // Add new audio tracks for video and audio clips
    timelineClips.forEach(async (clip) => {
      if ((clip.asset.type === 'video' || clip.asset.type === 'audio')) {
        // Check if track already exists by trying to get its state
        const existingTrack = audioEngine.getTrackState(clip.id);
        
        if (!existingTrack) {
          // URL is already resolved by getAllClips() using the resolvedUrls cache
          const audioUrl = clip.asset.url;
          
          console.log('🎵 Processing audio clip:', {
            clipId: clip.id,
            assetId: clip.asset_id,
            originalUrl: mediaAssets.find(a => a.id === clip.asset_id)?.local_asset_id ? 
              `indexeddb://${mediaAssets.find(a => a.id === clip.asset_id)?.local_asset_id}` : 'N/A',
            resolvedUrl: audioUrl,
            isIndexedDB: audioUrl.startsWith('indexeddb://')
          });
          
          // Ensure we're not using IndexedDB URLs
          if (audioUrl.startsWith('indexeddb://')) {
            console.error('❌ IndexedDB URL still being used for audio:', audioUrl);
            console.error('❌ Debug info:', {
              assetId: clip.asset_id,
              hasResolvedUrl: resolvedUrls.has(clip.asset_id),
              resolvedUrl: resolvedUrls.get(clip.asset_id),
              mediaAsset: mediaAssets.find(a => a.id === clip.asset_id)
            });
            return; // Skip this track to prevent errors
          }
          
          audioEngine.addTrack(
            clip.id,
            audioUrl, // Use pre-resolved URL from getAllClips
            clip.startTime,
            clip.endTime,
            clip.trimStart,
            clip.trimEnd
          ).then(() => {
            // Apply current volume and mute state after track is successfully added
            audioEngine.setTrackVolume(clip.id, clip.volume || 1);
            audioEngine.setTrackMuted(clip.id, clip.muted || false);
            console.log('✅ Audio track added successfully:', clip.id, audioUrl);
          }).catch(error => {
            console.warn('Failed to add audio track:', error);
          });
        }
      }
    });
    
    // Note: We don't remove tracks here to avoid complexity, they'll be cleaned up on unmount
  }, [clips.length, JSON.stringify(clips.map(c => ({id: c.id, volume: c.volume, muted: c.muted}))), resolvedUrls, mediaAssets]);

  // Note: Remotion video elements are muted at source level in video-preview.tsx and video-composition.tsx

  // Sync audio engine with timeline playback
  useEffect(() => {
    audioEngine.syncToTimeline(currentTime, isPlaying);
  }, [currentTime, isPlaying]);

  // Sync master volume and mute with audio engine
  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume);
    audioEngine.setMasterMuted(isMasterMuted);
  }, [masterVolume, isMasterMuted]);

  // Professional mouse wheel scrolling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Don't prevent default - let browser handle it naturally
    const scrollAmount = e.deltaY * 0.5; // Smooth scrolling speed
    
    if (e.shiftKey) {
      // Shift + wheel = horizontal scroll (like Premiere Pro)
      e.preventDefault(); // Only prevent when we handle it
      setTimelineOffset(prev => Math.max(0, prev + scrollAmount));
    } else {
      // Normal wheel = vertical scroll
      e.preventDefault(); // Only prevent when we handle it
      setVerticalOffset(prev => Math.max(0, prev + scrollAmount));
    }
  }, []);

  // Smart clip placement - always after playhead
  const getSmartDropPosition = (asset: any): number => {
    // Always place new clips at or after the current playhead position
    let dropPosition = currentTime;

    // Find the appropriate track
    const targetTrackType = asset.type === 'audio' ? 'audio' : 'video';
    const targetTrack = tracks.find((t: any) => t.track_type === targetTrackType);
    
    if (!targetTrack) {
      return dropPosition;
    }

    // Get clips in this track only
    const trackClips = targetTrack.clips.sort((a: any, b: any) => a.start_time - b.start_time);
    
    // Find the first available position at or after the playhead
    const clipsAfterPlayhead = trackClips.filter((clip: any) => clip.end_time > currentTime);
    
    if (clipsAfterPlayhead.length === 0) {
      // No clips after playhead, place at playhead or end of timeline
      const lastClipEnd = trackClips.length > 0 ? Math.max(...trackClips.map((c: any) => c.end_time)) : 0;
      dropPosition = Math.max(currentTime, lastClipEnd);
    } else {
      // Check if there's space at the playhead
      const mediaInfo = getMediaInfo(asset);
      const clipDuration = mediaInfo.duration || 5;
      const nextClip = clipsAfterPlayhead[0];
      
      if ((currentTime + clipDuration) <= nextClip.start_time) {
        // Enough space at playhead
        dropPosition = currentTime;
      } else {
        // Place after the conflicting clips
        dropPosition = nextClip.end_time;
      }
    }

    return Math.max(currentTime, dropPosition);
  };

  // Convert time to timeline position (accounting for offset)
  const timeToPosition = (time: number) => {
    return (time * PIXELS_PER_SECOND) + TIMELINE_PADDING - timelineOffset;
  };

  // Convert timeline position to time (accounting for offset)
  const positionToTime = (position: number) => {
    return ((position + timelineOffset - TIMELINE_PADDING) / PIXELS_PER_SECOND);
  };

  // Handle timeline scrubbing with mouse
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Don't handle if clicking on clips or controls
    if ((e.target as HTMLElement).closest('[data-clip-id]') || 
        (e.target as HTMLElement).closest('[data-resize-handle]') ||
        isDraggingClip || isResizing) {
      return;
    }

    setIsDraggingPlayhead(true);
    
    // Remove initial mouse position and time code
  };

  // Professional timeline scrubbing with sensitivity control - revert to original
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead || !timelineContainerRef.current) return;
      
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      
      // Professional scrubbing: Direct position calculation (not delta-based)
      const timelineMouseX = mouseX + timelineOffset - TIMELINE_PADDING;
      let newTime = Math.max(0, Math.min(totalDuration, timelineMouseX / PIXELS_PER_SECOND));
      
      // Fine scrubbing with modifier keys (like Premiere Pro)
      if (e.shiftKey) {
        // Fine scrubbing: 10x slower, snap to 0.1 second intervals
        newTime = Math.round(newTime * 10) / 10;
      } else if (e.ctrlKey || e.metaKey) {
        // Ultra-fine scrubbing: snap to frame boundaries (assume 30fps)
        newTime = Math.round(newTime * 30) / 30;
      } else {
        // Normal scrubbing: snap to 0.25 second intervals
        newTime = Math.round(newTime * 4) / 4;
      }
      
      setCurrentTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    if (isDraggingPlayhead) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDraggingPlayhead, totalDuration, setCurrentTime, PIXELS_PER_SECOND, timelineOffset]);

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveringTimeline(false);
    
    try {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const jsonData = e.dataTransfer.getData("application/json");
        if (!jsonData || jsonData.trim() === "") {
          handleExternalFileDrop(files, e);
          return;
        }
      }

      const jsonData = e.dataTransfer.getData("application/json");
      if (jsonData && jsonData.trim() !== "") {
        try {
          const data = JSON.parse(jsonData);
          if (data.assetId) {
            handleAssetDropFromPanel(data.assetId, e);
          }
        } catch (parseError) {
          console.error("Error parsing drag data:", parseError);
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  // Handle external file drop
  const handleExternalFileDrop = async (files: FileList, e: React.DragEvent) => {
    for (const file of Array.from(files)) {
      try {
        const asset = await uploadAndCreateMediaAsset(file);
        if (asset) {
          // Always use smart positioning (after playhead)
          const smartPosition = getSmartDropPosition(asset);
          addClipToTimeline(asset, smartPosition);
        }
      } catch (error) {
        console.error("Error handling external file drop:", error);
      }
    }
  };

  // Handle asset drop from media panel with track detection
  const handleAssetDropFromPanel = (assetId: string, e: React.DragEvent) => {
    const asset = mediaAssets.find((a: any) => a.id === assetId);
    
    if (!asset) {
      console.warn("Asset not found:", assetId);
      return;
    }

    // Calculate drop position relative to playhead and timeline offset
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const dropTime = positionToTime(mouseX);
    
    // Ensure clips are placed at or after playhead
    const finalDropTime = Math.max(currentTime, dropTime);
    const snappedTime = Math.round(finalDropTime * 4) / 4;
    
    // Detect which track area the user dropped onto
    const targetTrackType = detectDropTrack(e.target as HTMLElement);
    
    addClipToTimeline(asset, snappedTime, undefined, targetTrackType);
  };

  // Detect which track the user is dropping onto
  const detectDropTrack = (element: HTMLElement): 'video' | 'audio' | 'overlay' | undefined => {
    // Walk up the DOM tree to find track context
    let current = element;
    while (current && current !== document.body) {
      // Check for track-specific classes or data attributes
      if (current.dataset?.trackType) {
        return current.dataset.trackType as 'video' | 'audio' | 'overlay';
      }
      
      // Check for track container classes/structure
      const trackContainer = current.closest('[data-track-type]');
      if (trackContainer) {
        return trackContainer.getAttribute('data-track-type') as 'video' | 'audio' | 'overlay';
      }
      
      current = current.parentElement as HTMLElement;
    }
    
    return undefined; // Default track selection will be handled by addClipToTimeline
  };

  // Upload and create media asset
  const uploadAndCreateMediaAsset = async (file: File): Promise<any | null> => {
    try {
      const url = URL.createObjectURL(file);
      const type = detectFileType(file);
      
      if (type === "unknown") {
        console.warn(`Unsupported file type: ${file.name}`);
        return null;
      }

      let duration = 5;
      let dimensions: { width: number; height: number } | undefined;
      let video_metadata: any = undefined;

      try {
        if (type === "video") {
          const videoMeta = await getVideoMetadata(url);
          duration = videoMeta.duration;
          dimensions = {
            width: videoMeta.width,
            height: videoMeta.height,
          };
          video_metadata = {
            fps: videoMeta.fps,
            codec: 'unknown',
            bitrate: 'unknown',
          };
        } else if (type === "audio") {
          duration = await getMediaDuration(url, "audio");
        } else if (type === "image") {
          duration = 5;
          const imageDims = await getImageDimensions(url);
          dimensions = {
            width: imageDims.width,
            height: imageDims.height,
          };
        }
      } catch (metaError) {
        console.warn(`Could not extract metadata for ${file.name}:`, metaError);
        duration = type === "image" ? 5 : 10;
      }

      // Create the media asset with blob URL
      const assetId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const assetToAdd = {
        id: assetId,
        user_id: '', // Will be set by the addMediaAsset function
        title: file.name,
        description: '',
        tags: [],
        r2_object_key: url, // Using blob URL temporarily
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
        source_studio: 'video-studio',
        duration_seconds: duration,
        dimensions,
        video_metadata,
        thumbnails_generated: false,
        filmstrip_generated: false,
        ai_generated: false,
        ai_generation_data: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addMediaAsset(assetToAdd);
      
      const createdAsset = mediaAssets.find((a: any) => a.id === assetId);
      
      return createdAsset || null;
    } catch (error) {
      console.error("Error creating media asset:", error);
      return null;
    }
  };

  // Add clip to timeline with optional track type override
  const addClipToTimeline = (asset: any, startTime?: number, duration?: number, forceTrackType?: 'video' | 'audio' | 'overlay') => {
    // Get media info for determining track type
    const mediaInfo = getMediaInfo(asset);
    
    // Allow override of track type (for overlay functionality)
    const targetTrackType = forceTrackType || (mediaInfo.type === 'audio' ? 'audio' : 'video');
    const targetTrack = tracks.find((t: any) => t.track_type === targetTrackType);
    
    if (!targetTrack) {
      console.warn(`No ${targetTrackType} track found`);
      return;
    }

    const clipStartTime = startTime !== undefined ? startTime : getSmartDropPosition(asset);
    const clipDuration = duration || mediaInfo.duration || 5;

    const realAsset = mediaAssets.find((a: any) => 
      a.title === asset.title && a.r2_object_key === asset.r2_object_key
    );
      
    // Use the simplified addClip API that matches our store
    addClip(
      targetTrack.id,
      realAsset?.id || asset.id,
      clipStartTime,
      clipDuration
    );

    console.log(`Added ${targetTrackType} clip at ${clipStartTime}s for ${clipDuration}s (after playhead at ${currentTime}s)`);
  };

  // Handle clip dragging
  const handleClipMouseDown = (e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    // Calculate the offset within the clip where the mouse was clicked
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Store initial drag data more precisely
    setDragStartX(e.clientX);
    setDragStartTime(clip.start_time);
    setDragOffset(mouseX);
    
    // Make sure we select the clip before starting the drag
    // This ensures proper visual feedback during dragging
    setSelectedClipId(clipId);
    
    // Short delay before setting drag state to avoid accidental drags
    // This helps prevent inadvertent small movements from triggering a drag
    setTimeout(() => {
      if (selectedClipId === clipId) {
        setIsDraggingClip(true);
        setDraggingClipId(clipId);
      }
    }, 50);
  };

  // Handle clip resizing
  const handleResizeStart = (e: React.MouseEvent, clipId: string, handle: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    // Store initial resize position and the time value we're modifying
    setResizeStartX(e.clientX);
    setResizeStartTime(handle === 'left' ? clip.start_time : clip.end_time);
    
    setIsResizing(true);
    setResizeHandle(handle);
    setResizingClipId(clipId);
    setSelectedClipId(clipId);
  };

  // Resize handling
  useEffect(() => {
    // Threshold in pixels before resizing actually starts
    const RESIZE_THRESHOLD = 5; // Increased for more precise control
    let hasResizeStarted = false;
    let accumulatedDelta = 0; // Track accumulated mouse movement for smooth precise control
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizingClipId || !resizeHandle || !timelineContainerRef.current) return;
      
      // Check if we've exceeded the resize threshold
      if (!hasResizeStarted) {
        if (Math.abs(e.clientX - resizeStartX) < RESIZE_THRESHOLD) {
          return; // Don't start resizing until threshold is exceeded
        }
        hasResizeStarted = true;
      }
      
      // Check for auto-scroll during resize operations
      checkAutoScroll(e.clientX, e.clientY);
      
      // Calculate total movement from start position for precision
      const totalDeltaX = e.clientX - resizeStartX;
      
      // Apply sensitivity based on modifier keys for professional control
      let sensitivity = 1.0; // Default sensitivity
      
      if (e.shiftKey) {
        sensitivity = 0.25; // Fine control: 4x slower for precision editing
      } else if (e.ctrlKey || e.metaKey) {
        sensitivity = 0.1; // Ultra-fine control: 10x slower for frame-perfect editing
      }
      
      // Convert pixel delta to time delta with sensitivity
      const rawDeltaTime = (totalDeltaX * sensitivity) / PIXELS_PER_SECOND;
      
      const clip = clips.find(c => c.id === resizingClipId);
      if (!clip) return;

      const asset = mediaAssets.find((a: any) => a.id === clip.asset_id);
      if (!asset) return;

      const mediaInfo = getMediaInfo(asset);
      const assetDuration = mediaInfo.duration || 10;
      const minClipDuration = 0.1; // Reduced minimum for more precise control
      
      // Professional snapping based on modifier keys
      let deltaTime = rawDeltaTime;
      if (e.ctrlKey || e.metaKey) {
        // Frame-perfect editing: snap to 1/30 second (33.33ms) intervals
        deltaTime = Math.round(rawDeltaTime * 30) / 30;
      } else if (e.shiftKey) {
        // Fine editing: snap to 0.1 second intervals  
        deltaTime = Math.round(rawDeltaTime * 10) / 10;
      } else {
        // Normal editing: snap to 0.25 second intervals
        deltaTime = Math.round(rawDeltaTime * 4) / 4;
      }
      
      // Store the updated clip values to apply enhanced visibility afterward
      let updatedClip = { ...clip };

      if (resizeHandle === 'left') {
        // Left handle: adjust start time and trim start
        // Calculate new time based on the original start time plus delta
        let newStartTime = resizeStartTime + deltaTime;
        newStartTime = Math.max(0, Math.min(newStartTime, clip.end_time - minClipDuration));
        
        // Calculate how much the start time changed
        const timeChange = newStartTime - clip.start_time;
        
        if (mediaInfo.type === 'image') {
          // For images: Allow free extension (no trim constraints)
          updateClip(resizingClipId, {
            start_time: newStartTime,
            // Keep trim values unchanged for images
            trim_start: clip.trim_start,
          });
          
          // Update for visibility check
          updatedClip.start_time = newStartTime;
        } else {
          // For video/audio: Only allow trimming within the original asset duration
          
          // Calculate what the new trimStart should be
          // When startTime increases (drag right), trimStart should increase (trim more from start)
          // When startTime decreases (drag left), trimStart should decrease (trim less from start)
          const newTrimStart = clip.trim_start + timeChange;
          
          // Only allow if trimStart stays within valid bounds
          if (newTrimStart >= 0 && newTrimStart <= assetDuration && newTrimStart <= clip.trim_end - minClipDuration) {
          updateClip(resizingClipId, {
            start_time: newStartTime,
            trim_start: newTrimStart,
          });
          
          // Update for visibility check
          updatedClip.start_time = newStartTime;
          }
          // If we're trying to extend beyond available asset content, reject the resize
        }
      } else {
        // Right handle: adjust end time and trim end
        // Calculate new time based on the original end time plus delta
        let newEndTime = resizeStartTime + deltaTime;
        newEndTime = Math.max(clip.start_time + minClipDuration, newEndTime);
        
        // Calculate how much the end time changed
        const timeChange = newEndTime - clip.end_time;
        
        if (mediaInfo.type === 'image') {
          // For images: Allow free extension (no duration constraints)
          updateClip(resizingClipId, {
            end_time: newEndTime,
            // Keep trim values unchanged for images
            trim_end: clip.trim_end,
          });
          
          // Update for visibility check
          updatedClip.end_time = newEndTime;
        } else {
          // For video/audio: Only allow trimming within the original asset duration
          
          // Calculate the new clip duration and what trimEnd should be
          const newClipDuration = newEndTime - clip.start_time;
          const newTrimEnd = clip.trim_start + newClipDuration;
          
          // Only allow if the new trimEnd doesn't exceed the asset duration
          if (newTrimEnd <= assetDuration && newTrimEnd >= clip.trim_start + minClipDuration) {
          updateClip(resizingClipId, {
            end_time: newEndTime,
            trim_end: newTrimEnd,
          });
          
          // Update for visibility check
          updatedClip.end_time = newEndTime;
          }
          // If we're trying to extend beyond available asset content, reject the resize
        }
      }
      
      // Enhanced clip visibility logic - ensure clip edge being resized stays in view
      // Calculate the clip's position
      const clipLeft = (updatedClip.start_time * PIXELS_PER_SECOND) + TIMELINE_PADDING;
      const clipWidth = (updatedClip.end_time - updatedClip.start_time) * PIXELS_PER_SECOND;
      const clipRight = clipLeft + clipWidth;
      
      // Get timeline container dimensions
      const rect = timelineContainerRef.current.getBoundingClientRect();
      const viewportWidth = rect.width;
      
      // Calculate the visible range in the timeline
      const visibleLeft = timelineOffset;
      const visibleRight = visibleLeft + viewportWidth;
      
      // Only adjust when clip edge is significantly out of view (at least 100px)
      const outOfViewThreshold = 100;
      
      // When resizing right edge and moving out of view
      if (resizeHandle === 'right' && clipRight > visibleRight && clipRight - visibleRight > outOfViewThreshold) {
        // More gentle viewport adjustment - move only 50% of the way toward the edge
        const adjustmentAmount = (clipRight - visibleRight) * 0.5;
        const newOffset = timelineOffset + adjustmentAmount;
        setTimelineOffset(Math.max(0, newOffset));
      }
      
      // When resizing left edge and moving out of view
      if (resizeHandle === 'left' && clipLeft < visibleLeft && visibleLeft - clipLeft > outOfViewThreshold) {
        // More gentle viewport adjustment - move only 50% of the way toward the edge
        const adjustmentAmount = (visibleLeft - clipLeft) * 0.5;
        const newOffset = timelineOffset - adjustmentAmount;
        setTimelineOffset(Math.max(0, newOffset));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
      setResizingClipId(null);
      // Stop auto-scroll when resize ends
      stopAutoScroll();
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = resizeHandle === 'left' ? 'w-resize' : 'e-resize';
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing, resizingClipId, resizeHandle, clips, updateClip, mediaAssets, resizeStartX, resizeStartTime, PIXELS_PER_SECOND, timelineOffset]);

  // Clip dragging
  useEffect(() => {
    // Threshold in pixels before dragging actually starts
    const DRAG_THRESHOLD = 5;
    let hasDragStarted = false;
    
    // Keep track of total accumulated movement for precise positioning
    let accumulatedDeltaTime = 0;
    let previousClientX = dragStartX;
    let lastUpdateTime = Date.now();
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingClip || !draggingClipId || !timelineContainerRef.current) return;
      
      // Check if we've exceeded the drag threshold
      if (!hasDragStarted) {
        if (Math.abs(e.clientX - dragStartX) < DRAG_THRESHOLD) {
          return; // Don't start dragging until threshold is exceeded
        }
        hasDragStarted = true;
      }
      
      // Check for auto-scroll during drag operations
      checkAutoScroll(e.clientX, e.clientY);
      
      // Calculate movement delta since last frame
      const deltaX = e.clientX - previousClientX;
      previousClientX = e.clientX;
      
      // Calculate drag speed for visual feedback
      const now = Date.now();
      const timeDelta = now - lastUpdateTime;
      lastUpdateTime = now;
      
      // Update the visual drag direction and speed indicators
      if (deltaX !== 0) {
        setDragMovementDirection(deltaX > 0 ? 'right' : 'left');
        
        // Calculate speed indicator (0-100 scale) based on pixels per second
        // but with reduced sensitivity and clamping for better visual feedback
        const pixelsPerSecond = Math.abs(deltaX) / (timeDelta / 1000);
        const normalizedSpeed = Math.min(100, Math.round(pixelsPerSecond / 2));
        setDragSpeed(normalizedSpeed);
      }
      
      // Slow down the movement considerably for better control
      // Apply a drag dampening factor to make movements much slower and more controllable
      const DRAG_DAMPENING = 0.4; // 40% of original speed
      
      // Convert pixel delta to time delta (with dampening)
      const deltaTime = (deltaX * DRAG_DAMPENING) / PIXELS_PER_SECOND;
      
      // Add to accumulated delta (for smoother sub-pixel movements)
      accumulatedDeltaTime += deltaTime;
      
      const clip = clips.find(c => c.id === draggingClipId);
      if (clip) {
        const clipDuration = clip.end_time - clip.start_time;
        
        // Calculate new time based on original position plus accumulated delta
        // This approach ensures consistent drag behavior regardless of framerate
        let newStartTime = Math.max(0, dragStartTime + accumulatedDeltaTime);
        
        // Snap to 0.25 second intervals for more predictable dragging
        // Using Math.round for more natural feeling
        newStartTime = Math.round(newStartTime * 4) / 4;
        
        // Enforce minimum movement threshold to prevent jittering
        // This ensures a more stable dragging experience
        if (Math.abs(newStartTime - clip.start_time) >= 0.05) {
          updateClip(draggingClipId, {
            start_time: newStartTime,
            end_time: newStartTime + clipDuration,
          });
        }
        
        // Enhanced clip visibility logic - ensure clip stays in view by updating timeline offset
        // Calculate the expected clip position after update
        const clipLeft = (newStartTime * PIXELS_PER_SECOND) + TIMELINE_PADDING;
        const clipWidth = clipDuration * PIXELS_PER_SECOND;
        const clipRight = clipLeft + clipWidth;
        
        // Get timeline container dimensions
        const rect = timelineContainerRef.current.getBoundingClientRect();
        const viewportWidth = rect.width;
        
        // Calculate the visible range in the timeline
        const visibleLeft = timelineOffset;
        const visibleRight = visibleLeft + viewportWidth;
        
        // Use a fixed threshold for more predictable behavior
        const SCROLL_THRESHOLD = Math.min(100, clipWidth * 0.25);
        
        // If clip is moving out of view to the right, follow it - with gentle scrolling
        if (clipRight > visibleRight && clipRight - visibleRight > SCROLL_THRESHOLD) {
          // Use a fixed slow scroll speed rather than proportional for stability
          const newOffset = timelineOffset + Math.min(5, (clipRight - visibleRight) * 0.05);
          setTimelineOffset(Math.max(0, newOffset));
        }
        
        // If clip is moving out of view to the left, follow it - with gentle scrolling
        if (clipLeft < visibleLeft && visibleLeft - clipLeft > SCROLL_THRESHOLD) {
          // Use a fixed slow scroll speed rather than proportional for stability
          const newOffset = timelineOffset - Math.min(5, (visibleLeft - clipLeft) * 0.05);
          setTimelineOffset(Math.max(0, newOffset));
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingClip(false);
      setDraggingClipId(null);
      setDragMovementDirection(null);
      setDragSpeed(0);
      // Stop auto-scroll when drag ends
      stopAutoScroll();
    };

    if (isDraggingClip) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingClip, draggingClipId, clips, updateClip, dragStartX, dragStartTime, dragOffset, PIXELS_PER_SECOND, timelineOffset]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveringTimeline(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveringTimeline(false);
  };

  // Handle clip splitting
  const handleSplitClip = () => {
    if (!selectedClip) {
      console.warn('No clip selected for splitting');
      return;
    }

    if (currentTime <= selectedClip.start_time || currentTime >= selectedClip.end_time) {
      console.warn('Playhead is not within the selected clip bounds');
      return;
    }

    splitClip(selectedClip.id, currentTime);
    console.log(`Split clip ${selectedClip.asset.title} at ${formatTime(currentTime)}`);
  };

  // Handle clip deletion
  const handleDeleteClip = () => {
    if (!selectedClip) {
      console.warn('No clip selected for deletion');
      return;
    }

    // Confirm deletion for better UX
    const confirmMessage = `Delete "${selectedClip.asset.title}" clip?`;
    if (window.confirm(confirmMessage)) {
      removeClip(selectedClip.id);
      setSelectedClipId(null); // Clear selection after deletion
      console.log(`Deleted clip: ${selectedClip.asset.title}`);
    }
  };

  // Handle clip duplication - Professional editor style
  const handleDuplicateClip = () => {
    if (!selectedClip) {
      console.warn('No clip selected for duplication');
      return;
    }

    // Find the track this clip belongs to
    const sourceTrack = tracks.find((track: any) => track.id === selectedClip.track_id);
    if (!sourceTrack) {
      console.error('Source track not found for duplication');
      return;
    }

    // Calculate ideal placement - immediately after the original clip
    const originalEndTime = selectedClip.end_time;
    const clipDuration = selectedClip.end_time - selectedClip.start_time;
    let duplicateStartTime = originalEndTime;

    // Check for conflicts in the same track and find next available space
    const trackClips = sourceTrack.clips
      .filter((clip: any) => clip.id !== selectedClip.id) // Exclude the original clip
      .sort((a: any, b: any) => a.start_time - b.start_time);

    // Find first available space after the original clip
    for (const existingClip of trackClips) {
      if (existingClip.start_time >= duplicateStartTime) {
        if (duplicateStartTime + clipDuration <= existingClip.start_time) {
          // Found space before this clip
          break;
        } else {
          // Move past this conflicting clip
          duplicateStartTime = existingClip.end_time;
        }
      }
    }

    // Use the simplified addClip API that matches our store
    addClip(
      selectedClip.track_id,
      selectedClip.asset_id,
      duplicateStartTime,
      clipDuration
    );

    // Professional behavior: Select the new duplicate clip
    // We need to wait a bit for the clip to be added and get its ID
    setTimeout(() => {
      // Find the newly created clip (it should be the last one added to the track)
      const updatedTrack = tracks.find((track: any) => track.id === selectedClip.track_id);
      if (updatedTrack) {
        const newestClip = updatedTrack.clips
          .filter((clip: any) => clip.start_time === duplicateStartTime)
          .sort((a: any, b: any) => (b.id || '').localeCompare(a.id || ''))[0]; // Get the newest by ID
        
        if (newestClip) {
          setSelectedClipId(newestClip.id);
        }
      }
    }, 50); // Small delay to ensure the clip is added

    console.log(`Duplicated clip: ${selectedClip.asset.title} at ${formatTime(duplicateStartTime)}`);
  };

  // Professional Volume Controls (Pro Tools style)
  const [isVolumeControlsOpen, setIsVolumeControlsOpen] = useState(false);
  
  const handleMasterMuteToggle = () => {
    const newMuted = !isMasterMuted;
    setIsMasterMuted(newMuted);
    
    // Use professional audio engine for real muting
    audioEngine.setMasterMuted(newMuted);
    console.log(`🔇 Master ${newMuted ? 'muted' : 'unmuted'}`);
  };

  const handleClipMuteToggle = () => {
    if (!selectedClip) return;
    
    const newMutedState = !selectedClip.is_muted;
    updateClip(selectedClip.id, { is_muted: newMutedState });
    
    // Use professional audio engine for real muting
    audioEngine.setTrackMuted(selectedClip.id, newMutedState);
    console.log(`🔇 Clip ${selectedClip.asset.title} ${newMutedState ? 'muted' : 'unmuted'}`);
  };



  const handleVolumeChange = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setMasterVolume(clampedVolume);
    
    // Use professional audio engine for real volume control
    audioEngine.setMasterVolume(clampedVolume);
  };

  const handleClipVolumeChange = (newVolume: number) => {
    if (!selectedClip) return;
    
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    updateClip(selectedClip.id, { volume: clampedVolume });
    
    // Use professional audio engine for real volume control
    audioEngine.setTrackVolume(selectedClip.id, clampedVolume);
  };

  const toggleVolumeControls = () => {
    setIsVolumeControlsOpen(!isVolumeControlsOpen);
  };

  // Close volume controls when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if the click is outside the volume controls and the volume button
      if (isVolumeControlsOpen && 
          !target.closest('.volume-controls-panel') && 
          !target.closest('.volume-controls-button')) {
        setIsVolumeControlsOpen(false);
      }
    };

    if (isVolumeControlsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isVolumeControlsOpen]);

  // Pro Tools style: Determine current mute state and volume
  const getCurrentVolumeState = () => {
    if (selectedClip) {
      const effectiveVolume = (isMasterMuted || selectedClip.is_muted) ? 0 : (selectedClip.volume || 1);
      const displayVolume = selectedClip.volume || 1; // Always show actual volume level on slider
      
      return {
        isMuted: isMasterMuted || selectedClip.is_muted,
        volume: displayVolume, // For slider display
        effectiveVolume: effectiveVolume, // For actual audio
        isClipMuted: selectedClip.is_muted,
        label: `Clip: ${selectedClip.asset.title}`
      };
    }
    
    const effectiveVolume = isMasterMuted ? 0 : masterVolume;
    
    return {
      isMuted: isMasterMuted,
      volume: masterVolume, // For slider display
      effectiveVolume: effectiveVolume, // For actual audio
      isClipMuted: false,
      label: 'Master'
    };
  };

  const volumeState = getCurrentVolumeState();

  // Removed shuttle control functionality as requested

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Timeline Controls */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              // Resume audio context on play to fix user gesture requirement
              if (!isPlaying) {
                await audioEngine.resumeAudioContext();
              }
              setIsPlaying(!isPlaying);
            }}
            className="text-zinc-400 hover:text-white h-7 w-7 p-0"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
              className="text-zinc-400 hover:text-white h-7 w-7 p-0"
              title="Skip back 5 seconds"
            >
              <ChevronsLeft className="w-3 h-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 5))}
              className="text-zinc-400 hover:text-white h-7 w-7 p-0"
              title="Skip forward 5 seconds"
            >
              <ChevronsRight className="w-3 h-3" />
            </Button>
            
            {/* Frame navigation controls */}
            <div className="relative flex items-center bg-zinc-800/50 rounded-full h-6 px-1 ml-2 select-none">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white h-5 w-5 p-0"
                title="Previous Frame"
                onClick={() => stepFrame('left', 1)}
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white h-5 w-5 p-0"
                title="Next Frame"
                onClick={() => stepFrame('right', 1)}
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
            
            {isDraggingPlayhead && (
              <span className="text-xs text-blue-400 bg-blue-600/20 px-2 py-1 rounded">
                Shift: Fine • Ctrl: Frame-by-frame
              </span>
            )}
            
            {isDraggingClip && dragMovementDirection && (
              <span className={cn(
                "text-xs px-2 py-1 rounded flex items-center gap-1",
                dragMovementDirection === 'left' 
                  ? "text-amber-400 bg-amber-600/20" 
                  : "text-green-400 bg-green-600/20"
              )}>
                {dragMovementDirection === 'left' ? (
                  <ChevronLeft className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <span className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <span 
                    className={cn(
                      "h-full rounded-full transition-all duration-150",
                      dragMovementDirection === 'left' ? "bg-amber-500" : "bg-green-500"
                    )}
                    style={{width: `${dragSpeed}%`}}
                  />
                </span>
              </span>
            )}
            

            
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white h-7 px-2 text-xs"
              title="Show keyboard shortcuts"
              onClick={() => {
                alert(
                  "Timeline Keyboard Shortcuts\n\n" +
                  "PLAYBACK CONTROLS:\n" +
                  "J: Step backward 1 frame\n" +
                  "K: Stop playback\n" +
                  "L: Step forward 1 frame\n" +
                  "Shift+J: Step backward 5 frames\n" +
                  "Shift+L: Step forward 5 frames\n" +
                  "Space: Play/pause\n\n" +
                  "NAVIGATION:\n" +
                  "Left Arrow: Step backward 1 frame\n" +
                  "Right Arrow: Step forward 1 frame\n" +
                  "Shift+Left: Back 1 second\n" +
                  "Shift+Right: Forward 1 second\n" +
                  "Alt+Left: Back 10 frames\n" +
                  "Alt+Right: Forward 10 frames\n" +
                  "Ctrl+Left: Jump to previous clip\n" +
                  "Ctrl+Right: Jump to next clip\n" +
                  "Home: Jump to start\n" +
                  "End: Jump to end\n\n" +
                  "EDITING:\n" +
                  "S: Split clip at playhead\n" +
                  "Ctrl+D: Duplicate selected clip\n" +
                  "Delete/Backspace: Delete selected clip\n" +
                  "M: Toggle mute (selected clip or master)\n" +
                  "Click volume icon: Show volume slider"
                );
              }}
            >
              ⌨️ Shortcuts
            </Button>
          </div>

          {/* Editing Tools - Context Aware */}
          <div className="flex items-center gap-1 ml-4">
            <div className="w-px h-6 bg-zinc-700" />
            
            {/* Selected Clip Info */}
            {selectedClip && (
              <div className="flex items-center gap-2 mr-2">
                <div className="flex items-center gap-1">
                  {selectedClip.trackType === 'overlay' && <Layers className="w-3 h-3 text-purple-400" />}
                  {selectedClip.trackType === 'video' && <Film className="w-3 h-3 text-blue-400" />}
                  {selectedClip.trackType === 'audio' && <Music className="w-3 h-3 text-green-400" />}
                  <span className="text-xs text-zinc-400">
                    {selectedClip.trackType === 'overlay' && 'Overlay'}
                    {selectedClip.trackType === 'video' && 'Video'}
                    {selectedClip.trackType === 'audio' && 'Audio'}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">
                  {(selectedClip.end_time - selectedClip.start_time).toFixed(1)}s
                </span>
              </div>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSplitClip}
              disabled={!canSplitSelectedClip}
              className={cn(
                "text-zinc-400 hover:text-white h-7 w-7 p-0",
                canSplitSelectedClip && "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-600/20"
              )}
              title={canSplitSelectedClip ? "Split clip at playhead" : "Select a clip and position playhead to split"}
            >
              <Scissors className="w-3 h-3" />
            </Button>
            
            {selectedClip && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDuplicateClip}
                  className="text-zinc-400 hover:text-white h-7 w-7 p-0"
                  title="Duplicate selected clip"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteClip}
                  className="text-zinc-400 hover:text-red-400 hover:bg-red-600/20 h-7 w-7 p-0"
                  title="Delete selected clip"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Simple Volume Control */}
          <div className="relative flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleVolumeControls}
              className={cn(
                "h-7 w-7 p-0 transition-colors volume-controls-button",
                isVolumeControlsOpen 
                  ? "text-blue-400 hover:text-blue-300 bg-blue-600/20" 
                  : volumeState.isMuted 
                    ? "text-red-400 hover:text-red-300 bg-red-600/20" 
                    : "text-zinc-400 hover:text-white"
              )}
              title={volumeState.isMuted 
                ? `Volume: ${Math.round(volumeState.volume * 100)}% (MUTED)` 
                : `Volume: ${Math.round(volumeState.volume * 100)}%`}
            >
              {volumeState.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </Button>

            {/* Volume Slider extending from icon */}
            {isVolumeControlsOpen && (
              <div 
                className="absolute right-0 bottom-full mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 volume-controls-panel"
                style={{ 
                  width: '140px',
                  transform: 'translateX(14px)' // Align with center of volume icon
                }}
              >
                {/* Arrow pointing to volume icon */}
                <div className="absolute bottom-0 right-3 transform translate-y-full">
                  <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-zinc-700"></div>
                  <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-zinc-800 absolute bottom-0 transform translate-y-[-1px]"></div>
                </div>
                
                <div className="p-3 space-y-2">
                  {/* Volume percentage display */}
                  <div className="flex items-center justify-center">
                    <span className={cn(
                      "text-xs font-mono",
                      volumeState.isMuted ? "text-red-400" : "text-zinc-300"
                    )}>
                      {Math.round(volumeState.volume * 100)}%
                      {volumeState.isMuted && " (MUTED)"}
                    </span>
                  </div>
                  
                  {/* Volume slider */}
                  <div className="flex items-center gap-2">
                    <VolumeX className={cn(
                      "w-3 h-3 flex-shrink-0",
                      volumeState.isMuted ? "text-red-400" : "text-zinc-500"
                    )} />
                    <Slider
                      value={[volumeState.volume]}
                      onValueChange={(values) => {
                        const newVolume = values[0];
                        if (selectedClip) {
                          handleClipVolumeChange(newVolume);
                        } else {
                          handleVolumeChange(newVolume);
                        }
                      }}
                      max={1}
                      min={0}
                      step={0.01}
                      className={cn(
                        "flex-1",
                        volumeState.isMuted && "opacity-50"
                      )}
                      disabled={volumeState.isMuted}
                    />
                    <Volume2 className={cn(
                      "w-3 h-3 flex-shrink-0",
                      volumeState.isMuted ? "text-zinc-600" : "text-zinc-500"
                    )} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-zinc-700" />

          {/* Timeline Scale Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimelineScale(Math.max(0.5, timelineScale - 0.25))}
              className="text-zinc-400 hover:text-white h-7 px-2 text-xs"
              title="Zoom out"
            >
              -
            </Button>
            <span className="text-xs text-zinc-400 min-w-[3rem] text-center">
              {Math.round(timelineScale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimelineScale(Math.min(3, timelineScale + 0.25))}
              className="text-zinc-400 hover:text-white h-7 px-2 text-xs"
              title="Zoom in"
            >
              +
            </Button>
          </div>

          <div className="w-px h-6 bg-zinc-700" />
          
          {/* Add Overlay Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Dispatch a custom event to trigger the overlay dialog in OverlayControls
              const event = new CustomEvent('open-overlay-dialog');
              document.dispatchEvent(event);
            }}
            className="text-purple-400 hover:text-purple-300 hover:bg-purple-600/20 h-7 px-2 text-xs"
            title="Add overlay to timeline"
          >
            <Layers className="w-3 h-3 mr-1" />
            Overlay
          </Button>
        </div>
      </div>

      {/* CapCut-style Timeline with Fixed Playhead */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* CapCut-style Time Ruler */}
        <div className="h-10 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center shrink-0 relative">
          {/* Fixed Playhead in ruler */}
            <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white z-50 pointer-events-none"
            style={{ left: `${PLAYHEAD_POSITION}px` }}
          >
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-white rounded-full border-2 border-zinc-800 shadow-lg" />
            <div className="w-full h-full bg-white shadow-sm"></div>
          </div>

          <div className="overflow-hidden flex-1 relative">
            <div 
              className="relative h-6 transition-transform duration-100 ease-out"
              style={{ 
                width: `${timelineWidth}px`,
                transform: `translateX(-${timelineOffset}px)`
              }}
            >
                            {/* Major markers every 5 seconds */}
              {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }, (_, i) => (
                <div
                  key={`major-${i}`}
                  className="absolute bottom-0 w-px bg-zinc-400"
                  style={{ 
                    left: `${(i * 5 * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                    height: '20px'
                  }}
                />
              ))}

              {/* Second markers with numbers (CapCut style) */}
              {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => {
                // Skip zero second
                if (i === 0) return null;
                
                const isMainMarker = i % 5 === 0;
                
                return (
                  <React.Fragment key={`second-${i}`}>
                    {/* Marker line */}
                    <div
                      className={cn(
                        "absolute bottom-0 w-px",
                        isMainMarker ? "bg-zinc-400" : "bg-zinc-600"
                      )}
                      style={{ 
                        left: `${(i * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                        height: isMainMarker ? '20px' : '12px'
                      }}
                    />
                    
                    {/* Second number label */}
                    <div
                      className={cn(
                        "absolute bottom-full mb-1 text-xs font-medium select-none leading-none",
                        isMainMarker 
                          ? "text-white bg-zinc-700 px-1 py-0.5 rounded shadow-sm" 
                          : "text-zinc-400"
                      )}
                      style={{ 
                        left: `${(i * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      {i}
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Sub-second markers (every 0.5 seconds) for high zoom levels */}
              {timelineScale > 2 && Array.from({ length: Math.ceil(totalDuration * 2) + 1 }, (_, i) => {
                const timeValue = i * 0.5;
                // Skip whole second markers
                if (timeValue % 1 === 0) return null;
                
                return (
                  <div
                    key={`sub-${i}`}
                    className="absolute bottom-0 w-px bg-zinc-700"
                    style={{ 
                      left: `${(timeValue * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                      height: '6px'
                    }}
                  />
                );
              })}

              {/* Frame markers for ultra-high zoom (every frame at 30fps) */}
              {timelineScale > 3 && Array.from({ length: Math.ceil(totalDuration * 30) + 1 }, (_, i) => {
                const timeValue = i / 30;
                // Skip markers that align with seconds or half-seconds
                if (timeValue % 0.5 === 0) return null;
                
                return (
                  <div
                    key={`frame-${i}`}
                    className="absolute bottom-0 w-px bg-zinc-800"
                    style={{ 
                      left: `${(timeValue * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                      height: '3px'
                    }}
                  />
                );
              })}
              
              {/* Precise time labels for major markers */}
              {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }, (_, i) => {
                if (i === 0) return null; // Skip 0:00
                return (
                  <div
                    key={`time-${i}`}
                    className="absolute bottom-full mb-6 text-xs text-zinc-300 font-mono select-none bg-zinc-800 px-1.5 py-0.5 rounded shadow-sm"
                    style={{ 
                      left: `${(i * 5 * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    {formatTime(i * 5)}
                  </div>
                );
              })}

              {/* Current time indicator */}
              <div
                className="absolute bottom-full mb-1 text-xs text-white font-mono bg-blue-600 px-1.5 py-0.5 rounded shadow-lg select-none z-10"
                style={{ 
                  left: `${(currentTime * PIXELS_PER_SECOND) + TIMELINE_PADDING}px`,
                  transform: 'translateX(-50%)'
                }}
              >
                {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Timeline Content */}
        <div className="flex-1 overflow-hidden">
          {clips.length === 0 ? (
            /* Empty State */
            <div className="h-full p-4">
            <div 
                className={cn(
                  "h-32 flex items-center justify-center border-2 border-dashed rounded-lg bg-zinc-900/50 transition-colors",
                  isHoveringTimeline ? "border-blue-400 bg-blue-500/10" : "border-zinc-700"
                )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
              <div className="text-center">
                <Plus className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">
                    {isHoveringTimeline ? "Drop media here - clips will be added after playhead" : "Drag media here to start editing"}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Playhead is at {formatTime(currentTime)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* CapCut-style Timeline with Scrolling Content */
            <div 
              ref={timelineContainerRef}
              className="h-full relative cursor-crosshair overflow-hidden"
              onMouseDown={handleTimelineMouseDown}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onWheel={handleWheel}
              >
              {/* Fixed Playhead - spans full height */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white z-50 pointer-events-none"
                style={{ left: `${PLAYHEAD_POSITION}px` }}
              >
                <div className="w-full h-full bg-white opacity-80"></div>
              </div>

              {/* Split indicator */}
              {canSplitSelectedClip && (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-40 pointer-events-none"
                  style={{ left: `${PLAYHEAD_POSITION}px` }}
                >
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-400 rotate-45"></div>
                  <div className="w-full h-full bg-yellow-400"></div>
                </div>
              )}

              {/* Auto-scroll zone indicators (show during resize/drag) */}
              {(isResizing || isDraggingClip) && (
                <>
                  {/* Left auto-scroll zone */}
                  <div 
                    className="absolute top-0 bottom-0 left-0 bg-blue-500/5 border-r border-blue-500/20 z-30 pointer-events-none"
                    style={{ width: `${AUTO_SCROLL_ZONE}px` }}
                  >
                    <div className="flex items-center justify-center h-full">
                      <div className="text-blue-400 opacity-30">←</div>
                    </div>
                  </div>
                  
                  {/* Right auto-scroll zone */}
                  <div 
                    className="absolute top-0 bottom-0 right-0 bg-blue-500/5 border-l border-blue-500/20 z-30 pointer-events-none"
                    style={{ width: `${AUTO_SCROLL_ZONE}px` }}
                  >
                    <div className="flex items-center justify-center h-full">
                      <div className="text-blue-400 opacity-30">→</div>
                    </div>
                  </div>
                </>
              )}

              {/* Scrolling Timeline Content */}
              <div 
                className="p-4 space-y-2 transition-transform duration-100 ease-out"
                style={{ 
                  width: `${timelineWidth}px`,
                  transform: `translateX(-${timelineOffset}px) translateY(-${verticalOffset}px)`
                }}
              >
                {/* Overlay Track */}
                {(clipsByTrack.overlay.length > 0 || isHoveringTimeline) && (
                  <div className="space-y-1" data-track-type="overlay">
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-zinc-400 font-medium">Overlay</span>
                    </div>
                    <div 
                      className={cn(
                        "relative h-12 rounded-lg transition-colors border",
                        isHoveringTimeline ? "bg-purple-500/10 border-purple-400" : "bg-zinc-900/50 border-zinc-800"
                      )}
                      data-track-type="overlay"
                    >
                      {clipsByTrack.overlay.map((clip) => {
                        const clipWidth = (clip.end_time - clip.start_time) * PIXELS_PER_SECOND;
                        const clipLeft = (clip.start_time * PIXELS_PER_SECOND) + TIMELINE_PADDING;
                        
                        return (
                          <OverlayClip
                            key={clip.id}
                            clip={clip}
                            clipWidth={clipWidth}
                            clipLeft={clipLeft}
                            isSelected={selectedClipId === clip.id}
                            isDragging={isDraggingClip && draggingClipId === clip.id}
                            isResizing={isResizing && resizingClipId === clip.id}
                            onSelect={() => setSelectedClipId(clip.id)}
                            onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                            onResizeStart={(e, handle) => handleResizeStart(e, clip.id, handle)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Video Track */}
                {(clipsByTrack.video.length > 0 || isHoveringTimeline) && (
                  <div className="space-y-1" data-track-type="video">
                    <div className="flex items-center gap-2 mb-1">
                      <Film className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-zinc-400 font-medium">Video</span>
                    </div>
                    <div 
                      className={cn(
                        "relative h-12 rounded-lg transition-colors border",
                        isHoveringTimeline ? "bg-blue-500/10 border-blue-400" : "bg-zinc-900/50 border-zinc-800"
                      )}
                      data-track-type="video"
                    >
                      {clipsByTrack.video.map((clip) => {
                        const clipWidth = (clip.end_time - clip.start_time) * PIXELS_PER_SECOND;
                        const clipLeft = (clip.start_time * PIXELS_PER_SECOND) + TIMELINE_PADDING;
                        
                        return (
                          <VideoClip
                            key={clip.id}
                            clip={clip}
                            clipWidth={clipWidth}
                            clipLeft={clipLeft}
                            isSelected={selectedClipId === clip.id}
                            isDragging={isDraggingClip && draggingClipId === clip.id}
                            isResizing={isResizing && resizingClipId === clip.id}
                            onSelect={() => setSelectedClipId(clip.id)}
                            onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                            onResizeStart={(e, handle) => handleResizeStart(e, clip.id, handle)}
                                />
                        );
                      })}
                            </div>
                            </div>
                          )}

                {/* Audio Track */}
                {(clipsByTrack.audio.length > 0 || isHoveringTimeline) && (
                  <div className="space-y-1" data-track-type="audio">
                    <div className="flex items-center gap-2 mb-1">
                      <Music className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-zinc-400 font-medium">Audio</span>
                        </div>
                    <div 
                      className={cn(
                        "relative h-10 rounded-lg transition-colors border",
                        isHoveringTimeline ? "bg-green-500/10 border-green-400" : "bg-zinc-900/50 border-zinc-800"
                      )}
                      data-track-type="audio"
                    >
                      {clipsByTrack.audio.map((clip) => {
                        const clipWidth = (clip.end_time - clip.start_time) * PIXELS_PER_SECOND;
                        const clipLeft = (clip.start_time * PIXELS_PER_SECOND) + TIMELINE_PADDING;
                        
                        return (
                          <AudioClip
                            key={clip.id}
                            clip={clip}
                            clipWidth={clipWidth}
                            clipLeft={clipLeft}
                            isSelected={selectedClipId === clip.id}
                            isDragging={isDraggingClip && draggingClipId === clip.id}
                            isResizing={isResizing && resizingClipId === clip.id}
                            onSelect={() => setSelectedClipId(clip.id)}
                            onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
                            onResizeStart={(e, handle) => handleResizeStart(e, clip.id, handle)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
                    )}
        </div>
      </div>
    </div>
  );
} 