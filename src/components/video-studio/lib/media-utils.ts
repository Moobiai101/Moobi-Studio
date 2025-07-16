// Media utility functions for video studio

/**
 * Get the actual duration of a video or audio file
 */
export const getMediaDuration = (url: string, type: "video" | "audio"): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (type === "video") {
      const video = document.createElement("video");
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        resolve(video.duration);
      });
      video.addEventListener("error", () => {
        reject(new Error("Failed to load video metadata"));
      });
      video.load();
    } else if (type === "audio") {
      const audio = document.createElement("audio");
      audio.src = url;
      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration);
      });
      audio.addEventListener("error", () => {
        reject(new Error("Failed to load audio metadata"));
      });
      audio.load();
    }
  });
};

/**
 * Get dimensions of an image
 */
export const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
};

/**
 * Get video dimensions and metadata
 */
export const getVideoMetadata = (url: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps?: number;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.addEventListener("loadedmetadata", () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        // FPS detection is complex, default to 30
        fps: 30
      });
    });
    video.addEventListener("error", () => {
      reject(new Error("Failed to load video metadata"));
    });
    video.load();
  });
};

/**
 * Detect file type from MIME type or extension
 */
export const detectFileType = (file: File): "video" | "audio" | "image" | "unknown" => {
  // Check MIME type first
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  
  // Fallback to extension
  const extension = file.name.toLowerCase().split('.').pop();
  if (!extension) return "unknown";
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'];
  const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'];
  const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv', 'ogv'];
  
  if (imageExtensions.includes(extension)) return "image";
  if (audioExtensions.includes(extension)) return "audio";
  if (videoExtensions.includes(extension)) return "video";
  
  return "unknown";
};

/**
 * Create thumbnail for video
 */
export const createVideoThumbnail = (url: string, timeInSeconds = 1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }
    
    video.addEventListener("loadedmetadata", () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = Math.min(timeInSeconds, video.duration);
    });
    
    video.addEventListener("seeked", () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    });
    
    video.addEventListener("error", () => {
      reject(new Error("Failed to load video for thumbnail"));
    });
    
    video.src = url;
    video.load();
  });
};

/**
 * Preload media for smooth playback
 */
export const preloadMedia = (url: string, type: "video" | "audio") => {
  if (type === "video") {
    const video = document.createElement("video");
    video.src = url;
    video.load();
  } else if (type === "audio") {
    const audio = document.createElement("audio");
    audio.src = url;
    audio.load();
  }
};

// ===== PROFESSIONAL VIDEO FILMSTRIP GENERATION =====

/**
 * Configuration for filmstrip generation
 */
export interface FilmstripConfig {
  frameWidth: number;      // Width of each frame
  frameHeight: number;     // Height of each frame
  frameCount: number;      // Number of frames to extract
  quality: number;         // JPEG quality (0.1 - 1.0)
  layout: 'horizontal' | 'vertical' | 'grid'; // Layout type
  gridColumns?: number;    // For grid layout
  sourceStartTime?: number; // Optional: Start time within the source asset (seconds)
  sourceDuration?: number;  // Optional: Duration of the segment from the source asset (seconds)
}

/**
 * Default filmstrip configuration optimized for timeline clips
 */
export const DEFAULT_FILMSTRIP_CONFIG: FilmstripConfig = {
  frameWidth: 60,
  frameHeight: 34,
  frameCount: 10,
  quality: 0.7,
  layout: 'horizontal'
};

/**
 * Extract multiple frames from video at specified intervals
 * Based on professional video editor techniques
 */
export const extractVideoFrames = async (
  url: string,
  config: Partial<FilmstripConfig> = {}
): Promise<string[]> => {
  const finalConfig = { ...DEFAULT_FILMSTRIP_CONFIG, ...config };
  
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }
    
    // Configure canvas with proper dimensions
    canvas.width = finalConfig.frameWidth;
    canvas.height = finalConfig.frameHeight;
    
    // Professional video configuration (like YouTube thumbnail generation)
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true; // Prevent fullscreen on mobile
    video.preload = "metadata";
    
    const frames: string[] = [];
    let currentFrameIndex = 0;
    let isExtracting = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Determine the effective range for frame extraction
    const effectiveStartTime = finalConfig.sourceStartTime ?? 0;
    // Fallback to full video duration if sourceDuration is not specified or invalid
    const GUESSED_VIDEO_DURATION_FOR_FALLBACK = 600; // 10 minutes as a guess if video.duration is not yet available
    let effectiveDuration = finalConfig.sourceDuration;

    // Professional frame extraction with proper timing
    const extractCurrentFrame = () => {
      try {
        if (isExtracting) return; // Prevent race conditions
        isExtracting = true;
        
        // Ensure effectiveDuration is set once video.duration is available if not provided by config
        if (effectiveDuration === undefined || effectiveDuration <= 0) {
            effectiveDuration = video.duration > 0 ? video.duration - effectiveStartTime : GUESSED_VIDEO_DURATION_FOR_FALLBACK - effectiveStartTime;
            effectiveDuration = Math.max(0.1, effectiveDuration); // Ensure positive duration
        }

        // Clear canvas with professional approach
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw video frame with high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 with professional quality
        const frameData = canvas.toDataURL("image/jpeg", finalConfig.quality);
        frames.push(frameData);
        
        console.log(`Extracted frame ${currentFrameIndex + 1}/${finalConfig.frameCount} at time ${video.currentTime.toFixed(2)}s`);
        
        currentFrameIndex++;
        isExtracting = false;
        
        if (currentFrameIndex >= finalConfig.frameCount) {
          // All frames extracted successfully
          console.log(`Successfully extracted ${frames.length} frames for segment starting at ${effectiveStartTime.toFixed(2)}s with duration ${effectiveDuration.toFixed(2)}s`);
          resolve(frames);
          return;
        }
        
        // Professional approach: evenly distribute frames across the *effective* duration
        const segmentFrameInterval = effectiveDuration / Math.max(1, finalConfig.frameCount -1); // Avoid division by zero if frameCount is 1
        const timeInSegment = currentFrameIndex * segmentFrameInterval;
        // For the first frame (index 0), aim for the start of the segment, for others, distribute.
        // Adding a small portion of interval for subsequent frames to avoid being too close to previous seek point.
        const nextTimeInAsset = effectiveStartTime + (currentFrameIndex === 0 ? 0.05 : timeInSegment);

        // Clamp the target time to be safely within the overall video asset's duration
        const safeTimeToSeek = Math.min(Math.max(nextTimeInAsset, 0.01), video.duration > 0 ? video.duration - 0.01 : GUESSED_VIDEO_DURATION_FOR_FALLBACK );
        
        console.log(`Seeking to time: ${safeTimeToSeek.toFixed(2)}s (target in segment: ${(effectiveStartTime + timeInSegment).toFixed(2)}s) for frame ${currentFrameIndex + 1}/${finalConfig.frameCount}`);
        
        // Professional seeking with timeout protection
        timeoutId = setTimeout(() => {
          console.warn(`Seek timeout for frame ${currentFrameIndex}, continuing...`);
          video.currentTime = safeTimeToSeek; // Retry seek
        }, 2000);
        
        video.currentTime = safeTimeToSeek;
        
      } catch (error) {
        isExtracting = false;
        reject(new Error(`Frame extraction failed: ${error}`));
      }
    };
    
    // Professional event handling
    video.addEventListener("loadedmetadata", () => {
      console.log(`Video loaded: duration=${video.duration}s, size=${video.videoWidth}x${video.videoHeight}`);
      
      if (video.duration <= 0 && finalConfig.sourceDuration === undefined) {
        // This condition is tricky: if video.duration is 0 and we don't have a sourceDuration,
        // we might be in trouble. Rely on GUESSED_VIDEO_DURATION_FOR_FALLBACK or reject.
        console.warn("Video duration is 0 or invalid, and no sourceDuration provided. Filmstrip may be inaccurate or fail.");
        // Consider rejecting: reject(new Error("Invalid video duration and no sourceDuration provided"));
      }

      // Initialize effectiveDuration if it wasn't provided and video.duration is now available
      if (effectiveDuration === undefined || effectiveDuration <= 0) {
        effectiveDuration = video.duration > 0 ? video.duration - effectiveStartTime : GUESSED_VIDEO_DURATION_FOR_FALLBACK - effectiveStartTime;
        effectiveDuration = Math.max(0.1, effectiveDuration); 
      }
      
      // Start extraction from the beginning of the specified segment
      const initialSeekTime = Math.min(Math.max(effectiveStartTime + 0.05, 0.01), video.duration > 0 ? video.duration - 0.01 : GUESSED_VIDEO_DURATION_FOR_FALLBACK);
      video.currentTime = initialSeekTime;
      console.log(`Initial seek to ${initialSeekTime.toFixed(2)}s for filmstrip generation (effective start: ${effectiveStartTime.toFixed(2)}s)`);
    });
    
    video.addEventListener("loadeddata", () => {
      console.log("Video data loaded, ready for frame extraction");
    });
    
    video.addEventListener("seeked", () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Small delay to ensure frame is rendered
      setTimeout(extractCurrentFrame, 50);
    });
    
    video.addEventListener("error", (e) => {
      console.error("Video loading error:", e);
      reject(new Error("Failed to load video for frame extraction"));
    });
    
    video.addEventListener("stalled", () => {
      console.warn("Video stalled during loading");
    });
    
    // Start loading
    video.src = url;
    video.load();
    
    // Safety timeout (30 seconds max)
    setTimeout(() => {
      if (frames.length === 0) {
        reject(new Error("Frame extraction timeout - no frames captured"));
      }
    }, 30000);
  });
};

/**
 * Generate a filmstrip image from extracted frames
 * Implements professional video editor filmstrip techniques
 */
export const generateFilmstrip = async (
  frames: string[],
  config: Partial<FilmstripConfig> = {}
): Promise<string> => {
  const finalConfig = { ...DEFAULT_FILMSTRIP_CONFIG, ...config };
  
  return new Promise((resolve, reject) => {
    if (frames.length === 0) {
      reject(new Error("No frames provided"));
      return;
    }
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }
    
    // Calculate canvas dimensions based on layout
    let canvasWidth: number;
    let canvasHeight: number;
    
    switch (finalConfig.layout) {
      case 'horizontal':
        canvasWidth = finalConfig.frameWidth * frames.length;
        canvasHeight = finalConfig.frameHeight;
        break;
      case 'vertical':
        canvasWidth = finalConfig.frameWidth;
        canvasHeight = finalConfig.frameHeight * frames.length;
        break;
      case 'grid':
        const cols = finalConfig.gridColumns || Math.ceil(Math.sqrt(frames.length));
        const rows = Math.ceil(frames.length / cols);
        canvasWidth = finalConfig.frameWidth * cols;
        canvasHeight = finalConfig.frameHeight * rows;
        break;
      default:
        canvasWidth = finalConfig.frameWidth * frames.length;
        canvasHeight = finalConfig.frameHeight;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    let loadedImages = 0;
    const images: HTMLImageElement[] = [];
    
    // Load all frame images
    frames.forEach((frameData, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        loadedImages++;
        
        if (loadedImages === frames.length) {
          // All images loaded, draw filmstrip
          drawFilmstrip();
        }
      };
      img.onerror = () => {
        reject(new Error(`Failed to load frame ${index}`));
      };
      img.src = frameData;
    });
    
    const drawFilmstrip = () => {
      try {
        images.forEach((img, index) => {
          let x: number, y: number;
          
          switch (finalConfig.layout) {
            case 'horizontal':
              x = index * finalConfig.frameWidth;
              y = 0;
              break;
            case 'vertical':
              x = 0;
              y = index * finalConfig.frameHeight;
              break;
            case 'grid':
              const cols = finalConfig.gridColumns || Math.ceil(Math.sqrt(frames.length));
              x = (index % cols) * finalConfig.frameWidth;
              y = Math.floor(index / cols) * finalConfig.frameHeight;
              break;
            default:
              x = index * finalConfig.frameWidth;
              y = 0;
          }
          
          ctx.drawImage(img, x, y, finalConfig.frameWidth, finalConfig.frameHeight);
        });
        
        // Return filmstrip as base64
        resolve(canvas.toDataURL("image/jpeg", finalConfig.quality));
      } catch (error) {
        reject(new Error(`Filmstrip drawing failed: ${error}`));
      }
    };
  });
};

/**
 * One-shot function to create a complete filmstrip from video URL
 * This is the main function for timeline clip thumbnails
 */
export const createVideoFilmstrip = async (
  url: string,
  clipDuration: number,
  clipWidth: number,
  config: Partial<FilmstripConfig> = {}
): Promise<string> => {
  try {
    // Determine frameWidth to use, prioritizing caller's config
    const resolvedFrameWidth = config.frameWidth || DEFAULT_FILMSTRIP_CONFIG.frameWidth;

    // Determine frameCount, prioritizing caller's config.frameCount
    let resolvedFrameCount: number;
    if (config.frameCount !== undefined) {
      resolvedFrameCount = config.frameCount;
    } else {
      // Fallback: This logic is hit if VideoClip doesn't send frameCount.
      // The cap of 15 here was the original issue if this path was taken.
      // clipWidth in this context is the clipWidthFromHook (display width parameter)
      resolvedFrameCount = Math.max(3, Math.min(15, Math.floor(clipWidth / resolvedFrameWidth))); 
    }
    
    const filmstripConfig: FilmstripConfig = {
      frameWidth: resolvedFrameWidth,
      frameHeight: config.frameHeight || DEFAULT_FILMSTRIP_CONFIG.frameHeight,
      frameCount: resolvedFrameCount, // Uses the determined frameCount
      quality: config.quality || DEFAULT_FILMSTRIP_CONFIG.quality,
      layout: config.layout || DEFAULT_FILMSTRIP_CONFIG.layout,
      gridColumns: config.gridColumns, // Handles optional gridColumns, defaults to undefined if not in config
      sourceStartTime: config.sourceStartTime, // Handles optional sourceStartTime, defaults to undefined if not in config
      sourceDuration: config.sourceDuration // Handles optional sourceDuration, defaults to undefined if not in config
    };
    
    // Extract frames
    const frames = await extractVideoFrames(url, filmstripConfig);
    
    // Generate filmstrip
    const filmstrip = await generateFilmstrip(frames, filmstripConfig);
    
    return filmstrip;
  } catch (error) {
    console.warn("Filmstrip generation failed, falling back to single thumbnail:", error);
    // Fallback to single thumbnail
    return createVideoThumbnail(url, clipDuration * 0.3);
  }
};

/**
 * Cache for storing generated filmstrips
 * Implements professional video editor caching strategies
 */
class FilmstripCache {
  private cache = new Map<string, string>();
  private readonly maxSize = 100; // Maximum cached filmstrips
  
  private getCacheKey(url: string, config: FilmstripConfig): string {
    // Include all relevant config properties that affect the output
    return `${url}_${config.frameCount}_${config.frameWidth}_${config.frameHeight}_${config.quality}_${config.layout}_${config.sourceStartTime || 0}_${config.sourceDuration || 'full'}`;
  }
  
  get(url: string, config: FilmstripConfig): string | null {
    const key = this.getCacheKey(url, config);
    return this.cache.get(key) || null;
  }
  
  set(url: string, config: FilmstripConfig, filmstrip: string): void {
    const key = this.getCacheKey(url, config);
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value!;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, filmstrip);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Global filmstrip cache instance
export const filmstripCache = new FilmstripCache();

/**
 * Cached version of filmstrip creation for optimal performance
 */
export const createCachedVideoFilmstrip = async (
  url: string,
  clipDuration: number,
  clipWidth: number,
  config: Partial<FilmstripConfig> = {}
): Promise<string> => {
  const finalConfig = { ...DEFAULT_FILMSTRIP_CONFIG, ...config };
  
  // Check cache first
  const cached = filmstripCache.get(url, finalConfig);
  if (cached) {
    return cached;
  }
  
  // Generate new filmstrip
  const filmstrip = await createVideoFilmstrip(url, clipDuration, clipWidth, config);
  
  // Cache result
  filmstripCache.set(url, finalConfig, filmstrip);
  
  return filmstrip;
}; 