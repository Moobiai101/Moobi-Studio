"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useVideoProject } from "../hooks/use-video-project";
import { VideoComposition } from "./video-composition";
import { VideoTransformControls } from "./video-transform-controls";

export function VideoPreview() {
  const {
    project,
    tracks,
    mediaAssets,
    currentTime,
    isPlaying,
    playbackRate,
    setCurrentTime,
    setIsPlaying,
    updateClip,
  } = useVideoProject();

  const playerRef = useRef<PlayerRef>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Helper to safely get resolution
  const getResolution = () => {
    if (!project?.resolution || typeof project.resolution !== 'object') {
      return { width: 1920, height: 1080 };
    }
    const res = project.resolution as any;
    return {
      width: typeof res.width === 'number' ? res.width : 1920,
      height: typeof res.height === 'number' ? res.height : 1080
    };
  };

  // Helper to safely get FPS
  const getFPS = () => {
    return project?.fps || 30;
  };

  // Calculate total project duration based on clips
  const calculateProjectDuration = useCallback(() => {
    let maxEndTime = 0;
    tracks.forEach((track: any) => {
      track.clips.forEach((clip: any) => {
        maxEndTime = Math.max(maxEndTime, clip.end_time || 0);
      });
    });
    return Math.max(maxEndTime, 10); // Minimum 10 seconds
  }, [tracks]);

  // Memoize overlay clips to prevent infinite re-renders
  const overlayClips = useMemo(() => {
    const overlayTracks = tracks.filter((track: any) => track.track_type === 'overlay');
    const clips: any[] = [];
    
    overlayTracks.forEach((track: any) => {
      track.clips.forEach((clip: any) => {
        const asset = mediaAssets.find((a: any) => a.id === clip.asset_id);
        if (asset) {
          clips.push({
            ...clip,
            asset,
            track
          });
        }
      });
    });
    
    return clips;
  }, [tracks, mediaAssets]); // Only depend on tracks and mediaAssets

  const projectDuration = calculateProjectDuration();
  const resolution = getResolution();
  const fps = getFPS();
  const durationInFrames = Math.max(1, Math.floor(projectDuration * fps));
  const hasContent = mediaAssets.length > 0 && tracks.some((track: any) => track.clips.length > 0);

  // Transform update handler for overlays
  // DATABASE STORAGE NEEDED: This should update the clip transform data in database
  const handleTransformUpdate = useCallback((overlayId: string, transform: any) => {
    console.log('🎬 Updating overlay transform:', { overlayId, transform });
    
    // Find the overlay clip
    const overlayClip = overlayClips.find(clip => clip.id === overlayId);
    if (overlayClip) {
      // Update the clip with new transform data
      const updatedClip = {
        ...overlayClip,
        // Add transform data as a custom property
        overlayTransform: {
          ...((overlayClip as any).overlayTransform || {}),
          ...transform
        }
      };
      
      // Only update if transform actually changed
      const currentTransform = (overlayClip as any).overlayTransform || {};
      const hasChanged = 
        currentTransform.position?.x !== transform.position?.x ||
        currentTransform.position?.y !== transform.position?.y ||
        currentTransform.scale?.x !== transform.scale?.x ||
        currentTransform.scale?.y !== transform.scale?.y ||
        currentTransform.rotation !== transform.rotation;
      
      if (hasChanged) {
        // Update in project state
        updateClip(overlayId, updatedClip);
      }
      
      // PRODUCTION: Save to database here
      // Example: await saveClipTransform(overlayId, transform);
    }
  }, [updateClip]); // Remove overlayClips from dependencies to prevent loops

  // Player event handlers
  const handlePlayerRef = useCallback((player: PlayerRef | null) => {
    if (!player) return;
    
    playerRef.current = player;

    // Set up event listeners
    player.addEventListener("play", () => {
      setIsPlaying(true);
    });

    player.addEventListener("pause", () => {
      setIsPlaying(false);
    });

    player.addEventListener("seeked", (e) => {
      const frame = e.detail.frame;
      const time = frame / fps;
      setCurrentTime(time);
    });

    player.addEventListener("frameupdate", (e) => {
      const frame = e.detail.frame;
      const time = frame / fps;
      setCurrentTime(time);
    });

    player.addEventListener("ended", () => {
      setIsPlaying(false);
    });
  }, [fps, setCurrentTime, setIsPlaying]);

  // Sync external play/pause state with player
  useEffect(() => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
    }
  }, [isPlaying]);

  // Sync external seek with player
  useEffect(() => {
    if (!playerRef.current) return;
    
    const currentFrame = Math.floor(currentTime * fps);
    const playerFrame = playerRef.current.getCurrentFrame();
    
    // Only seek if there's a significant difference to avoid seek loops
    if (Math.abs(currentFrame - playerFrame) > 2) {
      playerRef.current.seekTo(currentFrame);
    }
  }, [currentTime, fps]);

  // Keep Remotion Player muted to prevent double audio with our audio engine
  useEffect(() => {
    if (!playerRef.current) return;

    const ensurePlayerMuted = () => {
      if (playerRef.current && !playerRef.current.isMuted()) {
        playerRef.current.mute();
      }
    };

    // Check immediately and then periodically
    ensurePlayerMuted();
    const muteInterval = setInterval(ensurePlayerMuted, 2000);

    return () => {
      clearInterval(muteInterval);
    };
  }, [playerRef]);

  // Don't render if no project
  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center px-8 h-full">
          <div className="w-32 h-32 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1" 
              className="text-zinc-600"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-3">Loading project...</h3>
          <p className="text-zinc-400 leading-relaxed max-w-sm">
            Please wait while we initialize your video project
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      {hasContent ? (
        <div 
          ref={videoContainerRef}
          className="w-full h-full flex items-center justify-center relative"
        >
          {/* Video Player Layer */}
          <Player
            ref={handlePlayerRef}
            component={VideoComposition}
            inputProps={{
              project: {
                project,
                tracks,
                mediaAssets
              },
            }}
            durationInFrames={durationInFrames}
            compositionWidth={resolution.width}
            compositionHeight={resolution.height}
            fps={fps}
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            controls={false}
            loop={false}
            autoPlay={false}
            showPosterWhenPaused={false}
            clickToPlay={false}
            doubleClickToFullscreen={true}
            spaceKeyToPlayOrPause={true}
            allowFullscreen={true}
            playbackRate={playbackRate}
            initiallyMuted={true}
            showVolumeControls={false}
            acknowledgeRemotionLicense={true}
          />
          
          {/* Transform Controls Layer - Professional overlay system */}
          {overlayClips.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              <VideoTransformControls
                overlays={overlayClips}
                videoContainerRef={videoContainerRef}
                onTransformUpdate={handleTransformUpdate}
                currentTime={currentTime}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center px-8 h-full">
          <div className="w-32 h-32 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1" 
              className="text-zinc-600"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-3">Start creating</h3>
          <p className="text-zinc-400 leading-relaxed max-w-sm">
            Upload media files or use AI tools to generate content for your video project
          </p>
        </div>
      )}
    </div>
  );
}