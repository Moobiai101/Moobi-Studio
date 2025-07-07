"use client";

import { 
  AbsoluteFill, 
  Audio, 
  Img, 
  Video, 
  useCurrentFrame, 
  useVideoConfig,
  Sequence 
} from "remotion";
import { getMediaInfo, EnhancedTimelineTrack, EnhancedTimelineClip } from "../store/video-project-store";
import { VideoEditorProject, UserAsset } from "@/types/database";

interface VideoCompositionProps {
  project: {
    project: VideoEditorProject | null;
    tracks: EnhancedTimelineTrack[];
    mediaAssets: UserAsset[];
  };
  currentTime?: number;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({
  project: { project, tracks, mediaAssets },
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Don't render if no project data
  if (!project || !tracks || !mediaAssets) {
    return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }

  // Get tracks by type (sort overlay tracks by creation order for proper layering)
  const videoTracks = tracks.filter(track => track.track_type === "video");
  const overlayTracks = tracks.filter(track => track.track_type === "overlay");
  const audioTracks = tracks.filter(track => track.track_type === "audio");

  // Note: All video elements are muted so Audio Engine can control audio

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Render video tracks first (base layer) */}
      {videoTracks.map((track, trackIndex) => (
        <VideoTrackSequence 
          key={track.id}
          track={track}
          mediaAssets={mediaAssets}
          fps={project.fps}
          zIndex={10 + (videoTracks.length - trackIndex)}
        />
      ))}
      
      {/* Render overlay tracks on top with higher z-index */}
      {overlayTracks.map((track, trackIndex) => (
        <OverlayTrackSequence 
          key={track.id}
          track={track}
          mediaAssets={mediaAssets}
          fps={project.fps}
          zIndex={100 + trackIndex} // Higher z-index for overlays
        />
      ))}
      
      {/* Audio tracks disabled - Professional Audio Engine handles all audio */}
      {/* {audioTracks.map((track) => (
        <AudioTrackSequence 
          key={track.id}
          track={track}
          mediaAssets={mediaAssets}
          fps={project.fps}
        />
      ))} */}
    </AbsoluteFill>
  );
};

// Video track sequence renderer
interface TrackSequenceProps {
  track: EnhancedTimelineTrack;
  mediaAssets: UserAsset[];
  fps: number;
  zIndex?: number;
}

const VideoTrackSequence: React.FC<TrackSequenceProps> = ({ 
  track, 
  mediaAssets, 
  fps,
  zIndex = 0 
}) => {
  return (
    <AbsoluteFill style={{ zIndex }}>
      {track.clips.map((clip: EnhancedTimelineClip) => {
        const asset = mediaAssets.find((a: UserAsset) => a.id === clip.asset_id);
        if (!asset) return null;

        const mediaInfo = getMediaInfo(asset);
        const startFrame = Math.floor(clip.start_time * fps);
        const clipDuration = clip.end_time - clip.start_time;
        const durationInFrames = Math.floor(clipDuration * fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={30} // Premount 1 second for smooth playback
          >
            {mediaInfo.type === "video" ? (
              <VideoClipRenderer asset={asset} mediaInfo={mediaInfo} clip={clip} fps={fps} />
            ) : mediaInfo.type === "image" ? (
              <ImageClipRenderer asset={asset} mediaInfo={mediaInfo} clip={clip} fps={fps} />
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
  mediaAssets, 
  fps,
  zIndex = 100 
}) => {
  return (
    <AbsoluteFill style={{ 
      zIndex, 
      mixBlendMode: (track.blend_mode as any) || 'normal', 
      opacity: track.opacity || 1 
    }}>
      {track.clips.map((clip: EnhancedTimelineClip) => {
        const asset = mediaAssets.find((a: UserAsset) => a.id === clip.asset_id);
        if (!asset) return null;

        const mediaInfo = getMediaInfo(asset);
        const startFrame = Math.floor(clip.start_time * fps);
        const clipDuration = clip.end_time - clip.start_time;
        const durationInFrames = Math.floor(clipDuration * fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={30}
          >
            {mediaInfo.type === "video" ? (
              <OverlayVideoRenderer asset={asset} mediaInfo={mediaInfo} clip={clip} track={track} fps={fps} />
            ) : mediaInfo.type === "image" ? (
              <OverlayImageRenderer asset={asset} mediaInfo={mediaInfo} clip={clip} track={track} fps={fps} />
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
  mediaAssets,
  fps
}) => {
  return (
    <>
      {track.clips.map((clip: EnhancedTimelineClip) => {
        const asset = mediaAssets.find((a: UserAsset) => a.id === clip.asset_id);
        if (!asset || !asset.content_type.startsWith('audio/')) return null;

        const mediaInfo = getMediaInfo(asset);
        const startFrame = Math.floor(clip.start_time * fps);
        const clipDuration = clip.end_time - clip.start_time;
        const durationInFrames = Math.floor(clipDuration * fps);

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={30}
          >
            <Audio
              src={mediaInfo.url}
              volume={clip.volume || 1}
              startFrom={Math.floor((clip.trim_start || 0) * fps)}
              endAt={Math.floor((clip.trim_end || clipDuration) * fps)}
            />
          </Sequence>
        );
      })}
    </>
  );
};
*/

// Individual clip renderers
const VideoClipRenderer: React.FC<{
  asset: UserAsset;
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: EnhancedTimelineClip;
  fps: number;
}> = ({ asset, mediaInfo, clip, fps }) => {
  return (
    <Video
      src={mediaInfo.url}
      startFrom={Math.floor((clip.trim_start || 0) * fps)}
      endAt={Math.floor((clip.trim_end || (clip.end_time - clip.start_time)) * fps)}
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
  asset: UserAsset;
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: EnhancedTimelineClip;
  fps: number;
}> = ({ asset, mediaInfo, clip, fps }) => {
  return (
    <Img
      src={mediaInfo.url}
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
  asset: UserAsset;
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: EnhancedTimelineClip;
  track: EnhancedTimelineTrack;
  fps: number;
}> = ({ asset, mediaInfo, clip, track, fps }) => {
  // Get transform data from clip with proper defaults
  const defaultTransform = {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1
  };
  
  // Extract transform data safely from clip.transform_data or overlayTransform
  let transform = defaultTransform;
  if (clip.transform_data && typeof clip.transform_data === 'object') {
    const transformData = clip.transform_data as any;
    transform = {
      position: transformData.position || defaultTransform.position,
      scale: transformData.scale || defaultTransform.scale,
      rotation: transformData.rotation ?? defaultTransform.rotation,
      opacity: transformData.opacity ?? defaultTransform.opacity
    };
  } else if ((clip as any).overlayTransform) {
    const clipTransform = (clip as any).overlayTransform;
    transform = {
      position: clipTransform.position || defaultTransform.position,
      scale: clipTransform.scale || defaultTransform.scale,
      rotation: clipTransform.rotation ?? defaultTransform.rotation,
      opacity: clipTransform.opacity ?? defaultTransform.opacity
    };
  }

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
    mixBlendMode: (track.blend_mode as any) || 'normal',
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
          startFrom={Math.floor((clip.trim_start || 0) * fps)}
          endAt={Math.floor((clip.trim_end || (clip.end_time - clip.start_time)) * fps)}
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
  asset: UserAsset;
  mediaInfo: ReturnType<typeof getMediaInfo>;
  clip: EnhancedTimelineClip;
  track: EnhancedTimelineTrack;
  fps: number;
}> = ({ asset, mediaInfo, clip, track, fps }) => {
  // Get transform data from clip with proper defaults
  const defaultTransform = {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1
  };
  
  // Extract transform data safely from clip.transform_data or overlayTransform
  let transform = defaultTransform;
  if (clip.transform_data && typeof clip.transform_data === 'object') {
    const transformData = clip.transform_data as any;
    transform = {
      position: transformData.position || defaultTransform.position,
      scale: transformData.scale || defaultTransform.scale,
      rotation: transformData.rotation ?? defaultTransform.rotation,
      opacity: transformData.opacity ?? defaultTransform.opacity
    };
  } else if ((clip as any).overlayTransform) {
    const clipTransform = (clip as any).overlayTransform;
    transform = {
      position: clipTransform.position || defaultTransform.position,
      scale: clipTransform.scale || defaultTransform.scale,
      rotation: clipTransform.rotation ?? defaultTransform.rotation,
      opacity: clipTransform.opacity ?? defaultTransform.opacity
    };
  }

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
    mixBlendMode: (track.blend_mode as any) || 'normal',
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