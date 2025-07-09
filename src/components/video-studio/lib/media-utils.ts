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
 * Create thumbnail for video with URL resolution support
 */
export const createVideoThumbnail = async (url: string, timeInSeconds = 1): Promise<string> => {
  const securityManager = VideoSecurityManager.getInstance();
  
  // Validate and resolve URL if needed
  const validation = securityManager.validateVideoUrl(url);
  if (!validation.isValid) {
    throw new Error(`Security validation failed: ${validation.reason}`);
  }

  let resolvedUrl = url;
  if (validation.needsResolution) {
    try {
      const { MediaUrlResolver } = await import('@/lib/video/media-url-resolver');
      resolvedUrl = await MediaUrlResolver.resolveUrl(url);
    } catch (error) {
      console.error('Failed to resolve IndexedDB URL for thumbnail:', error);
      throw new Error(`URL resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      } catch (drawError) {
        reject(new Error(`Failed to draw video frame: ${drawError}`));
      }
    });
    
    video.addEventListener("error", () => {
      reject(new Error("Failed to load video for thumbnail"));
    });
    
    video.src = resolvedUrl;
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

// ===== PRODUCTION-GRADE SECURITY CONFIGURATION =====

/**
 * Production-grade security configuration for video processing
 * Following OWASP guidelines and enterprise security standards
 */
interface SecurityConfig {
  allowedOrigins: string[];
  allowedDomains: string[];
  maxFileSize: number;
  allowedMimeTypes: string[];
  corsStrategy: 'strict' | 'permissive' | 'custom';
  enableLogging: boolean;
  allowIndexedDBUrls: boolean; // New: Allow IndexedDB URLs for local-first storage
}

/**
 * Default security configuration - customize for your environment
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedOrigins: [
    'https://moobilabs.com',
    'https://*.moobilabs.com',
    'https://cdn.moobilabs.com',
    // Add your CDN and trusted domains here
  ],
  allowedDomains: [
    'moobilabs.com',
    'r2.cloudflarestorage.com', // Cloudflare R2
    'amazonaws.com', // AWS S3
    'googleapis.com', // Google Cloud Storage
    // Add your trusted storage providers
  ],
  maxFileSize: 500 * 1024 * 1024, // 500MB max
  allowedMimeTypes: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ],
  corsStrategy: 'strict',
  enableLogging: true,
  allowIndexedDBUrls: true // Enable IndexedDB URL support for local-first storage
};

/**
 * Security utility functions for production-grade validation
 */
class VideoSecurityManager {
  private static instance: VideoSecurityManager;
  private config: SecurityConfig;
  private securityLog: Array<{ timestamp: number; event: string; url: string; severity: 'info' | 'warning' | 'error' }> = [];

  private constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  static getInstance(config?: Partial<SecurityConfig>): VideoSecurityManager {
    if (!VideoSecurityManager.instance) {
      VideoSecurityManager.instance = new VideoSecurityManager(config);
    }
    return VideoSecurityManager.instance;
  }

     /**
    * Validate URL against security policies
    * Enterprise-grade URL validation with threat protection
    */
   validateVideoUrl(url: string): { isValid: boolean; reason?: string; corsStrategy: 'anonymous' | 'none' | 'reject'; needsResolution?: boolean } {
     try {
       // Handle IndexedDB URLs specially for local-first storage
       if (url.startsWith('indexeddb://')) {
         if (this.config.allowIndexedDBUrls) {
           this.logSecurityEvent('IndexedDB URL detected - needs resolution', url, 'info');
           return { isValid: true, corsStrategy: 'none', needsResolution: true };
         } else {
           this.logSecurityEvent('IndexedDB URLs disabled by policy', url, 'warning');
           return { isValid: false, reason: 'IndexedDB URLs not allowed', corsStrategy: 'reject' };
         }
       }

       const urlObj = new URL(url);
       
       // Security checks for standard URLs
       if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:' && urlObj.protocol !== 'blob:' && urlObj.protocol !== 'data:') {
         this.logSecurityEvent('Invalid protocol detected', url, 'error');
         return { isValid: false, reason: 'Invalid protocol', corsStrategy: 'reject' };
       }

      // Check for suspicious patterns (potential attacks)
      const suspiciousPatterns = [
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /<script/i,
        /eval\(/i
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
          this.logSecurityEvent('Suspicious URL pattern detected', url, 'error');
          return { isValid: false, reason: 'Suspicious URL pattern', corsStrategy: 'reject' };
        }
      }

             // Local and blob URLs are always safe
       if (urlObj.protocol === 'blob:' || urlObj.protocol === 'data:') {
         return { isValid: true, corsStrategy: 'none', needsResolution: false };
       }

       // Same origin check
       if (this.isSameOrigin(url)) {
         return { isValid: true, corsStrategy: 'none', needsResolution: false };
       }

      // Check against allowed domains
      const isAllowedDomain = this.config.allowedDomains.some(domain => {
        return urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`);
      });

      if (!isAllowedDomain) {
        this.logSecurityEvent('Domain not in allowlist', url, 'warning');
        
        if (this.config.corsStrategy === 'strict') {
          return { isValid: false, reason: 'Domain not allowed', corsStrategy: 'reject' };
        }
      }

      // Check against allowed origins
      const isAllowedOrigin = this.config.allowedOrigins.some(origin => {
        if (origin.includes('*')) {
          const pattern = origin.replace(/\*/g, '.*');
          return new RegExp(`^${pattern}$`).test(urlObj.origin);
        }
        return urlObj.origin === origin;
      });

             if (isAllowedOrigin) {
         return { isValid: true, corsStrategy: 'anonymous', needsResolution: false };
       }

       // Default behavior based on strategy
       switch (this.config.corsStrategy) {
         case 'strict':
           return { isValid: false, reason: 'Origin not allowed', corsStrategy: 'reject' };
         case 'permissive':
           this.logSecurityEvent('Permissive mode: allowing external URL', url, 'warning');
           return { isValid: true, corsStrategy: 'anonymous', needsResolution: false };
         case 'custom':
           // Allow with anonymous CORS but log for monitoring
           this.logSecurityEvent('Custom mode: allowing with anonymous CORS', url, 'info');
           return { isValid: true, corsStrategy: 'anonymous', needsResolution: false };
         default:
           return { isValid: false, reason: 'Unknown strategy', corsStrategy: 'reject' };
       }

    } catch (error) {
      this.logSecurityEvent('URL parsing failed', url, 'error');
      return { isValid: false, reason: 'Malformed URL', corsStrategy: 'reject' };
    }
  }

  private isSameOrigin(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.origin === window.location.origin || url.startsWith('/');
    } catch {
      return false;
    }
  }

  private logSecurityEvent(event: string, url: string, severity: 'info' | 'warning' | 'error'): void {
    if (!this.config.enableLogging) return;

    // Sanitize URL for logging (remove sensitive parts)
    const sanitizedUrl = this.sanitizeUrlForLogging(url);
    
    this.securityLog.push({
      timestamp: Date.now(),
      event,
      url: sanitizedUrl,
      severity
    });

    // Keep log size manageable
    if (this.securityLog.length > 1000) {
      this.securityLog = this.securityLog.slice(-500);
    }

    // Console logging for development (remove in production)
    if (process.env.NODE_ENV === 'development') {
      const logMethod = severity === 'error' ? console.error : 
                       severity === 'warning' ? console.warn : console.log;
      logMethod(`[VideoSecurity] ${event}: ${sanitizedUrl}`);
    }
  }

  private sanitizeUrlForLogging(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove query parameters and fragments that might contain sensitive data
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return '[malformed-url]';
    }
  }

  getSecurityLogs(): typeof this.securityLog {
    return [...this.securityLog];
  }

  clearSecurityLogs(): void {
    this.securityLog = [];
  }
}

// ===== ENHANCED FILMSTRIP GENERATION WITH SECURITY =====

/**
 * Extract multiple frames from video with enterprise-grade security
 * Production-ready implementation with comprehensive security controls and URL resolution
 */
export const extractVideoFrames = async (
  url: string,
  config: Partial<FilmstripConfig> = {}
): Promise<string[]> => {
  const finalConfig = { ...DEFAULT_FILMSTRIP_CONFIG, ...config };
  const securityManager = VideoSecurityManager.getInstance();
  
  // Enterprise-grade URL validation
  const validation = securityManager.validateVideoUrl(url);
  if (!validation.isValid) {
    throw new Error(`Security validation failed: ${validation.reason}`);
  }

  if (validation.corsStrategy === 'reject') {
    throw new Error('URL rejected by security policy');
  }

  // Resolve IndexedDB URLs to blob URLs if needed
  let resolvedUrl = url;
  if (validation.needsResolution) {
    try {
      // Import MediaUrlResolver dynamically to avoid circular dependencies
      const { MediaUrlResolver } = await import('@/lib/video/media-url-resolver');
      resolvedUrl = await MediaUrlResolver.resolveUrl(url);
      console.log(`Resolved IndexedDB URL: ${url} -> ${resolvedUrl}`);
    } catch (error) {
      console.error('Failed to resolve IndexedDB URL:', error);
      throw new Error(`URL resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return new Promise((resolve, reject) => {
    
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }
    
    // Configure canvas with security-aware dimensions
    canvas.width = Math.min(finalConfig.frameWidth, 1920); // Security: Cap max dimensions
    canvas.height = Math.min(finalConfig.frameHeight, 1080);
    
    // Production-grade video configuration with security controls
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.controls = false;
    video.autoplay = false; // Security: Prevent autoplay
    
    // Apply CORS strategy based on security validation
    if (validation.corsStrategy === 'anonymous') {
      video.crossOrigin = "anonymous";
    }
    // For 'none' strategy, we don't set crossOrigin attribute

    const frames: string[] = [];
    let currentFrameIndex = 0;
    let isExtracting = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let hasStartedExtraction = false;
    let corsRetryAttempted = false;

    // Security: Limit frame extraction duration
    const effectiveStartTime = Math.max(0, finalConfig.sourceStartTime ?? 0);
    const SECURITY_MAX_DURATION = 3600; // 1 hour max for security
    let effectiveDuration = finalConfig.sourceDuration;

    // Enhanced frame extraction with security controls
    const extractCurrentFrame = () => {
      try {
        if (isExtracting) return;
        isExtracting = true;
        
        if (effectiveDuration === undefined || effectiveDuration <= 0) {
          effectiveDuration = video.duration > 0 
            ? Math.min(video.duration - effectiveStartTime, SECURITY_MAX_DURATION)
            : Math.min(600, SECURITY_MAX_DURATION);
          effectiveDuration = Math.max(0.1, effectiveDuration);
        }

        // Security: Clear canvas to prevent data leakage
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Enhanced drawing with comprehensive security error handling
        try {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Security: Limit output quality and size
          const quality = Math.min(finalConfig.quality, 0.95);
          const frameData = canvas.toDataURL("image/jpeg", quality);
          
          // Security: Check frame data size (prevent memory exhaustion)
          if (frameData.length > 10 * 1024 * 1024) { // 10MB limit per frame
            throw new Error("Frame data exceeds security limits");
          }
          
          frames.push(frameData);
          
          console.log(`Extracted frame ${currentFrameIndex + 1}/${finalConfig.frameCount} at time ${video.currentTime.toFixed(2)}s`);
          
        } catch (drawError) {
          console.warn(`Failed to draw video frame: ${drawError}`);
          isExtracting = false;
          
          if (drawError instanceof DOMException && drawError.name === 'SecurityError') {
            reject(new Error("Canvas tainted by cross-origin data - security protection active"));
          } else {
            reject(new Error(`Frame extraction failed: ${drawError}`));
          }
          return;
        }
        
        currentFrameIndex++;
        isExtracting = false;
        
        if (currentFrameIndex >= finalConfig.frameCount) {
          console.log(`Successfully extracted ${frames.length} frames`);
          resolve(frames);
          return;
        }
        
        // Continue with next frame
        const segmentFrameInterval = effectiveDuration / Math.max(1, finalConfig.frameCount - 1);
        const timeInSegment = currentFrameIndex * segmentFrameInterval;
        const nextTimeInAsset = effectiveStartTime + (currentFrameIndex === 0 ? 0.05 : timeInSegment);
        const safeTimeToSeek = Math.min(Math.max(nextTimeInAsset, 0.01), 
          video.duration > 0 ? video.duration - 0.01 : SECURITY_MAX_DURATION);
        
        timeoutId = setTimeout(() => {
          console.warn(`Seek timeout for frame ${currentFrameIndex}`);
          if (video.readyState >= 2) {
            video.currentTime = safeTimeToSeek;
          }
        }, 5000); // Reduced timeout for security
        
        video.currentTime = safeTimeToSeek;
        
      } catch (error) {
        isExtracting = false;
        reject(new Error(`Frame extraction failed: ${error}`));
      }
    };
    
    // Production-grade event handling with security monitoring
    video.addEventListener("loadedmetadata", () => {
      console.log(`Video loaded: duration=${video.duration}s, size=${video.videoWidth}x${video.videoHeight}`);
      hasStartedExtraction = true;
      
      // Security: Validate video metadata
      if (video.duration > SECURITY_MAX_DURATION) {
        console.warn(`Video duration (${video.duration}s) exceeds security limit`);
      }
      
      if (video.videoWidth > 4096 || video.videoHeight > 4096) {
        console.warn(`Video dimensions (${video.videoWidth}x${video.videoHeight}) exceed security limits`);
      }

      if (effectiveDuration === undefined || effectiveDuration <= 0) {
        effectiveDuration = video.duration > 0 
          ? Math.min(video.duration - effectiveStartTime, SECURITY_MAX_DURATION)
          : Math.min(600, SECURITY_MAX_DURATION);
        effectiveDuration = Math.max(0.1, effectiveDuration); 
      }
      
      const initialSeekTime = Math.min(Math.max(effectiveStartTime + 0.05, 0.01), 
        video.duration > 0 ? video.duration - 0.01 : SECURITY_MAX_DURATION);
      video.currentTime = initialSeekTime;
    });
    
    video.addEventListener("seeked", () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      setTimeout(extractCurrentFrame, 100);
    });
    
    video.addEventListener("error", (e) => {
      const errorCode = video.error?.code;
      const errorMessage = video.error?.message || 'Unknown video error';
      
      console.error("Video loading error:", { code: errorCode, message: errorMessage });
      
      // Enhanced CORS retry with security validation
      if (!corsRetryAttempted && validation.corsStrategy === 'anonymous' && 
          errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        corsRetryAttempted = true;
        console.log("Retrying video load without CORS...");
        
        video.removeAttribute('crossorigin');
        video.load();
        return;
      }
      
      // Security-aware error categorization
      let errorType = "Video loading failed";
      switch (errorCode) {
        case MediaError.MEDIA_ERR_NETWORK:
          errorType = "Network error loading video";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorType = "Video format not supported";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorType = "Video source not accessible";
          break;
        case MediaError.MEDIA_ERR_ABORTED:
          errorType = "Video loading aborted";
          break;
      }
      
      reject(new Error(errorType));
    });
    
    // Start loading with comprehensive error handling using resolved URL
    try {
      video.src = resolvedUrl;
      video.load();
    } catch (loadError) {
      reject(new Error(`Failed to start video loading: ${loadError}`));
    }
    
    // Security: Stricter timeout for production
    setTimeout(() => {
      if (frames.length === 0 && !hasStartedExtraction) {
        reject(new Error("Video loading timeout"));
      } else if (frames.length === 0) {
        reject(new Error("Frame extraction timeout"));
      } else if (frames.length < finalConfig.frameCount) {
        console.warn(`Partial extraction: ${frames.length}/${finalConfig.frameCount} frames`);
        resolve(frames);
      }
    }, 30000); // Reduced timeout for security
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
 * Cache for storing generated filmstrips with error tracking
 * Implements professional video editor caching strategies
 */
class FilmstripCache {
  private cache = new Map<string, string>();
  private errorCache = new Map<string, { error: string; timestamp: number }>();
  private readonly maxSize = 50; // Reduced to prevent memory issues
  private readonly errorCacheTimeout = 300000; // 5 minutes
  
  private getCacheKey(url: string, config: FilmstripConfig): string {
    // Include all relevant config properties that affect the output
    const sourceKey = config.sourceStartTime !== undefined && config.sourceDuration !== undefined 
      ? `_${config.sourceStartTime.toFixed(2)}-${config.sourceDuration.toFixed(2)}`
      : '';
    return `${url}_${config.frameCount}_${config.frameWidth}_${config.frameHeight}_${config.quality}_${config.layout}${sourceKey}`;
  }
  
  get(url: string, config: FilmstripConfig): string | null {
    const key = this.getCacheKey(url, config);
    
    // Check if this URL/config recently failed
    const errorEntry = this.errorCache.get(key);
    if (errorEntry && Date.now() - errorEntry.timestamp < this.errorCacheTimeout) {
      throw new Error(errorEntry.error);
    }
    
    return this.cache.get(key) || null;
  }
  
  set(url: string, config: FilmstripConfig, filmstrip: string): void {
    const key = this.getCacheKey(url, config);
    
    // Clear any error cache for successful generation
    this.errorCache.delete(key);
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value!;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, filmstrip);
  }
  
  setError(url: string, config: FilmstripConfig, error: string): void {
    const key = this.getCacheKey(url, config);
    this.errorCache.set(key, { error, timestamp: Date.now() });
    
    // Limit error cache size
    if (this.errorCache.size > this.maxSize) {
      const firstKey = this.errorCache.keys().next().value!;
      this.errorCache.delete(firstKey);
    }
  }
  
  clear(): void {
    this.cache.clear();
    this.errorCache.clear();
  }
}

// Global filmstrip cache instance
export const filmstripCache = new FilmstripCache();

// Export security manager for configuration
export { VideoSecurityManager, type SecurityConfig };

/**
 * Cached version of filmstrip creation for optimal performance with error caching
 */
export const createCachedVideoFilmstrip = async (
  url: string,
  clipDuration: number,
  clipWidth: number,
  config: Partial<FilmstripConfig> = {}
): Promise<string> => {
  // Validate inputs early
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid video URL provided');
  }
  
  if (clipDuration <= 0 || clipWidth <= 0) {
    throw new Error('Invalid clip dimensions provided');
  }
  
  const finalConfig = { ...DEFAULT_FILMSTRIP_CONFIG, ...config };
  
  try {
    // Check cache first (this will throw if there's a cached error)
    const cached = filmstripCache.get(url, finalConfig);
    if (cached) {
      return cached;
    }
    
    // Generate new filmstrip
    const filmstrip = await createVideoFilmstrip(url, clipDuration, clipWidth, config);
    
    // Cache successful result
    filmstripCache.set(url, finalConfig, filmstrip);
    
    return filmstrip;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Cache certain types of errors to prevent repeated attempts
    if (errorMessage.includes('CORS') || 
        errorMessage.includes('cross-origin') ||
        errorMessage.includes('not accessible') ||
        errorMessage.includes('Malformed')) {
      filmstripCache.setError(url, finalConfig, errorMessage);
    }
    
    throw error;
  }
}; 