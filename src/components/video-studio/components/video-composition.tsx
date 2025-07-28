"use client";

import React, { useState, useEffect } from "react";
import { 
  AbsoluteFill, 
  Audio, 
  Img, 
  Video, 
  useCurrentFrame, 
  useVideoConfig,
  Sequence 
} from "remotion";
import { useVideoProject } from "../hooks/use-video-project";
import { VideoProject, TimelineClip, MediaAsset, getMediaInfo, getMediaInfoWithBlobUrl } from "../store/video-project-store";

interface VideoCompositionProps {
  project: VideoProject;
  currentTime?: number;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  project,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Get tracks by type (sort overlay tracks by creation order for proper layering)
  const videoTracks = project.tracks.filter(track => track.type === "video");
  const overlayTracks = project.tracks.filter(track => track.type === "overlay");
  const audioTracks = project.tracks.filter(track => track.type === "audio");

  // Note: All video elements are muted so Audio Engine can control audio

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Render video tracks first (base layer) */}
      {videoTracks.map((track, trackIndex) => (
        <VideoTrackSequence 
          key={track.id}
          track={track}
          project={project}
          zIndex={10 + (videoTracks.length - trackIndex)}
        />
      ))}
      
      {/* Render overlay tracks on top with higher z-index */}
      {overlayTracks.map((track, trackIndex) => (
        <OverlayTrackSequence 
          key={track.id}
          track={track}
          project={project}
          zIndex={100 + trackIndex} // Higher z-index for overlays
        />
      ))}
      
      {/* Audio tracks disabled - Professional Audio Engine handles all audio */}
      {/* {audioTracks.map((track) => (
        <AudioTrackSequence 
          key={track.id}
          track={track}
          project={project}
        />
      ))} */}
    </AbsoluteFill>
  );
};

// Video track sequence renderer
interface TrackSequenceProps {
  track: any;
  project: VideoProject;
  zIndex?: number;
}

const VideoTrackSequence: React.FC<TrackSequenceProps> = ({ 
  track, 
  project, 
  zIndex = 0 
}) => {
  return (
    <AbsoluteFill style={{ zIndex }}>
      {track.clips.map((clip: TimelineClip) => {
        const asset = project.mediaAssets.find((a: MediaAsset) => a.id === clip.mediaId);
        if (!asset) return null;

        const mediaInfo = getMediaInfo(asset);
        const startFrame = Math.floor(clip.startTime * project.fps);
        const clipDuration = clip.endTime - clip.startTime;
        const durationInFrames = Math.floor(clipDuration * project.fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={30} // Premount 1 second for smooth playback
          >
            {mediaInfo.type === "video" ? (
              <VideoClipRenderer mediaInfo={mediaInfo} clip={clip} />
            ) : mediaInfo.type === "image" ? (
              <ImageClipRenderer mediaInfo={mediaInfo} clip={clip} />
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// Overlay track sequence renderer (for professional overlay compositing)
const OverlayTrackSequence: React.FC<TrackSequenceProps> = ({ 
  track, 
  project, 
  zIndex = 100 
}) => {
  return (
    <AbsoluteFill style={{ zIndex, mixBlendMode: track.blendMode || 'normal', opacity: track.opacity || 1 }}>
      {track.clips.map((clip: TimelineClip) => {
        const asset = project.mediaAssets.find((a: MediaAsset) => a.id === clip.mediaId);
        if (!asset) return null;

        const mediaInfo = getMediaInfo(asset);
        const startFrame = Math.floor(clip.startTime * project.fps);
        const clipDuration = clip.endTime - clip.startTime;
        const durationInFrames = Math.floor(clipDuration * project.fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={30}
          >
            {mediaInfo.type === "video" ? (
              <OverlayVideoRenderer mediaInfo={mediaInfo} clip={clip} track={track} />
            ) : mediaInfo.type === "image" ? (
              <OverlayImageRenderer mediaInfo={mediaInfo} clip={clip} track={track} />
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// Audio track sequence renderer - DISABLED (Professional Audio Engine handles all audio)
/* 
const AudioTrackSequence: React.FC<TrackSequenceProps> = ({ 
  track, 
  project 
}) => {
  return (
    <>
      {track.clips.map((clip: TimelineClip) => {
        const asset = project.mediaAssets.find((a: MediaAsset) => a.id === clip.mediaId);
        if (!asset || asset.type !== "audio") return null;

        const startFrame = Math.floor(clip.startTime * project.fps);
        const clipDuration = clip.endTime - clip.startTime;
        const durationInFrames = Math.floor(clipDuration * project.fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={30}
          >
            <Audio
              src={asset.url}
              volume={clip.volume}
              startFrom={Math.floor(clip.trimStart * project.fps)}
              endAt={Math.floor(clip.trimEnd * project.fps)}
            />
          </Sequence>
        );
      })}
    </>
  );
};
*/

// Production-grade video clip renderer with IndexedDB blob URL support
const VideoClipRenderer: React.FC<{
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: TimelineClip;
}> = ({ mediaInfo, clip }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(mediaInfo.url);

  // **PRODUCTION FIX: Resolve blob URL for video playback**
  useEffect(() => {
    const resolveVideoUrl = async () => {
      if (!mediaInfo.url.startsWith('blob:') && !mediaInfo.url.startsWith('http')) {
        try {
          const resolvedInfo = await getMediaInfoWithBlobUrl({ ...mediaInfo, fingerprint: mediaInfo.url });
          if (resolvedInfo.url !== mediaInfo.url) {
            setResolvedUrl(resolvedInfo.url);
            console.log(`🎬 Resolved video URL for clip: ${resolvedInfo.url.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error('Failed to resolve video URL for clip:', error);
        }
      }
    };

    resolveVideoUrl();
  }, [mediaInfo.url, mediaInfo]);

  return (
    <Video
      src={resolvedUrl}
      startFrom={Math.floor(clip.trimStart * 30)}
      endAt={Math.floor(clip.trimEnd * 30)}
      volume={0} // Muted - Audio Engine handles all audio
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
      // Add error handling and loading states
      onError={(error) => {
        console.error("Video loading error:", error);
      }}
    />
  );
};

const ImageClipRenderer: React.FC<{
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: TimelineClip;
}> = ({ mediaInfo, clip }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(mediaInfo.url);

  // **PRODUCTION FIX: Resolve blob URL for image display**
  useEffect(() => {
    const resolveImageUrl = async () => {
      if (!mediaInfo.url.startsWith('blob:') && !mediaInfo.url.startsWith('http')) {
        try {
          const resolvedInfo = await getMediaInfoWithBlobUrl({ ...mediaInfo, fingerprint: mediaInfo.url });
          if (resolvedInfo.url !== mediaInfo.url) {
            setResolvedUrl(resolvedInfo.url);
            console.log(`🖼️ Resolved image URL for clip: ${resolvedInfo.url.substring(0, 50)}...`);
          }
        } catch (error) {
          console.error('Failed to resolve image URL for clip:', error);
        }
      }
    };

    resolveImageUrl();
  }, [mediaInfo.url, mediaInfo]);

  return (
    <Img
      src={resolvedUrl}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
      // Add error handling
      onError={(error) => {
        console.error("Image loading error:", error);
      }}
    />
  );
};

// Overlay renderers (with professional compositing support and transform data)
const OverlayVideoRenderer: React.FC<{
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: TimelineClip;
  track: any;
}> = ({ mediaInfo, clip, track }) => {
  // Get transform data from clip with proper defaults
  const defaultTransform = {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1
  };
  
  const clipTransform = (clip as any).overlayTransform || {};
  const transform = {
    position: clipTransform.position || defaultTransform.position,
    scale: clipTransform.scale || defaultTransform.scale,
    rotation: clipTransform.rotation ?? defaultTransform.rotation,
    opacity: clipTransform.opacity ?? defaultTransform.opacity
  };

  const aspectRatio = mediaInfo.metadata?.width && mediaInfo.metadata?.height 
    ? mediaInfo.metadata.width / mediaInfo.metadata.height 
    : 16 / 9;

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    width: '50%', // Default overlay size
    aspectRatio: `${aspectRatio}`,
    opacity: (track.opacity || 1) * transform.opacity,
    mixBlendMode: track.blendMode || 'normal',
    transform: `translate(${transform.position.x}px, ${transform.position.y}px) scale(${transform.scale.x}, ${transform.scale.y}) rotate(${transform.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: 'auto'
  };

  return (
    <div style={containerStyle}>
      <div 
        style={overlayStyle}
        data-overlay-id={clip.id}
        className="video-overlay-element"
        onClick={(e) => e.stopPropagation()}
      >
        <Video
          src={mediaInfo.url}
          startFrom={Math.floor(clip.trimStart * 30)}
          endAt={Math.floor(clip.trimEnd * 30)}
          volume={0} // Muted - Audio Engine handles all audio
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          onError={(error) => {
            console.error("Overlay video loading error:", error);
          }}
        />
      </div>
    </div>
  );
};

const OverlayImageRenderer: React.FC<{
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: TimelineClip;
  track: any;
}> = ({ mediaInfo, clip, track }) => {
  // Get transform data from clip with proper defaults
  const defaultTransform = {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1
  };
  
  const clipTransform = (clip as any).overlayTransform || {};
  const transform = {
    position: clipTransform.position || defaultTransform.position,
    scale: clipTransform.scale || defaultTransform.scale,
    rotation: clipTransform.rotation ?? defaultTransform.rotation,
    opacity: clipTransform.opacity ?? defaultTransform.opacity
  };

  const aspectRatio = mediaInfo.metadata?.width && mediaInfo.metadata?.height
    ? mediaInfo.metadata.width / mediaInfo.metadata.height
    : 1 / 1; // Default to square for images

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    width: '50%', // Default overlay size
    aspectRatio: `${aspectRatio}`,
    opacity: (track.opacity || 1) * transform.opacity,
    mixBlendMode: track.blendMode || 'normal',
    transform: `translate(${transform.position.x}px, ${transform.position.y}px) scale(${transform.scale.x}, ${transform.scale.y}) rotate(${transform.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: 'auto'
  };

  return (
    <div style={containerStyle}>
      <div 
        style={overlayStyle}
        data-overlay-id={clip.id}
        className="video-overlay-element"
        onClick={(e) => e.stopPropagation()}
      >
        <Img
          src={mediaInfo.url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          onError={(error) => {
            console.error("Overlay image loading error:", error);
          }}
        />
      </div>
    </div>
  );
}; 