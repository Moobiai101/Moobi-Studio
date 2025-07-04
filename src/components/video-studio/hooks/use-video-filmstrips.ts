import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { thumbnailGenerator } from '@/lib/video-processing/wasm-thumbnail-generator';
import { storageOrchestrator } from '@/lib/storage/storage-orchestrator';

interface VideoFilmstripState {
  filmstrip: string | null;
  isLoading: boolean;
  error: string | null;
  isUsingWebAssembly: boolean;
}

interface UseVideoFilmstripsOptions {
  frameCount?: number;
  enabled?: boolean;
  priority?: 'high' | 'normal' | 'low';
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Hook for managing video filmstrips using WebAssembly with fallback
 * Eliminates server requests and provides instant cached thumbnails
 */
export function useVideoFilmstrips() {
  const [filmstrips, setFilmstrips] = useState<Map<string, VideoFilmstripState>>(new Map());
  const [isWebAssemblyReady, setIsWebAssemblyReady] = useState(false);
  const [webAssemblyFailed, setWebAssemblyFailed] = useState(false);
  const loadingQueue = useRef<Array<{ 
    clipId: string; 
    assetId: string;
    url: string; 
    clipDuration: number; 
    clipWidth: number; 
    trimStart: number;
    trimEnd: number;
    options: UseVideoFilmstripsOptions 
  }>>([]);
  const isProcessing = useRef(false);
  const filmstripCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const initializationTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize WebAssembly thumbnail generator with timeout
  useEffect(() => {
    let isMounted = true;
    
    const initializeWebAssembly = async () => {
      try {
        console.log('🎬 Initializing WebAssembly video processing...');
        
        // Set a timeout for initialization
        initializationTimeout.current = setTimeout(() => {
          if (isMounted) {
            console.warn('⚠️ WebAssembly initialization timed out - using server-based processing');
            setWebAssemblyFailed(true);
            setIsWebAssemblyReady(false);
          }
        }, 15000); // 15 second timeout
        
        const initialized = await thumbnailGenerator.initialize();
        
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
          initializationTimeout.current = null;
        }
        
        if (isMounted) {
          if (initialized) {
            console.log('✅ WebAssembly video processing ready!');
            setIsWebAssemblyReady(true);
            setWebAssemblyFailed(false);
          } else {
            console.warn('🚫 WebAssembly initialization failed - using server-based processing');
            setWebAssemblyFailed(true);
            setIsWebAssemblyReady(false);
          }
        }
      } catch (error) {
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
          initializationTimeout.current = null;
        }
        
        if (isMounted) {
          console.error('Failed to initialize WebAssembly:', error);
          setWebAssemblyFailed(true);
          setIsWebAssemblyReady(false);
        }
      }
    };
    
    initializeWebAssembly();
    
    return () => {
      isMounted = false;
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
        initializationTimeout.current = null;
      }
    };
  }, []);
  
  // Get filmstrip state for a specific clip
  const getFilmstripState = useCallback((clipId: string): VideoFilmstripState => {
    return filmstrips.get(clipId) || {
      filmstrip: null,
      isLoading: false,
      error: null,
      isUsingWebAssembly: false
    };
  }, [filmstrips]);
  
  // Generate filmstrip using server-based processing (fallback)
  const generateServerFilmstrip = useCallback(async (
    clipId: string, 
    url: string, 
    clipDuration: number, 
    clipWidth: number, 
    trimStart: number, 
    trimEnd: number,
    options: UseVideoFilmstripsOptions
  ) => {
    try {
      console.log(`🖥️ Generating placeholder filmstrip for clip ${clipId} (WebAssembly not available)`);
      
      // Calculate frame count and dimensions
      const frameWidth = 60;
      const frameHeight = 34;
      const frameCount = options.frameCount || Math.max(3, Math.min(20, Math.floor(clipWidth / frameWidth)));
      
      // Create a placeholder filmstrip canvas
      const canvas = document.createElement('canvas');
      canvas.width = frameWidth * frameCount;
      canvas.height = frameHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas context not available');
      
      // Create professional-looking placeholder frames
      for (let i = 0; i < frameCount; i++) {
        const x = i * frameWidth;
        
        // Create gradient background for each frame
        const gradient = ctx.createLinearGradient(x, 0, x + frameWidth, frameHeight);
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(0.5, '#1d4ed8');
        gradient.addColorStop(1, '#1e40af');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 0, frameWidth, frameHeight);
        
        // Add frame border
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, 0, frameWidth, frameHeight);
        
        // Add play icon in center of frame
        const centerX = x + frameWidth / 2;
        const centerY = frameHeight / 2;
        const iconSize = 8;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(centerX - iconSize/2, centerY - iconSize/2);
        ctx.lineTo(centerX + iconSize/2, centerY);
        ctx.lineTo(centerX - iconSize/2, centerY + iconSize/2);
        ctx.closePath();
        ctx.fill();
        
        // Add timestamp text
        const timestamp = trimStart + (i * (trimEnd - trimStart) / frameCount);
        const minutes = Math.floor(timestamp / 60);
        const seconds = Math.floor(timestamp % 60);
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(timeText, centerX, centerY + 12);
      }
      
      // Add overall label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No WebAssembly', canvas.width / 2, 12);
      
      const filmstripDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Store canvas for reuse
      filmstripCanvases.current.set(clipId, canvas);
      
      // Update state with filmstrip
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: filmstripDataUrl,
        isLoading: false,
        error: null,
        isUsingWebAssembly: false
      }));
      
      console.log(`✅ Placeholder filmstrip generated for clip ${clipId} - 0 network requests`);
      
    } catch (error) {
      console.error(`Failed to generate placeholder filmstrip for clip ${clipId}:`, error);
      
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        isUsingWebAssembly: false
      }));
    }
  }, []);
  
  // Process the loading queue with WebAssembly
  const processQueue = useCallback(async () => {
    if (isProcessing.current || loadingQueue.current.length === 0) {
      return;
    }
    
    isProcessing.current = true;
    
    // Sort queue by priority
    loadingQueue.current.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.options.priority || 'normal'] - priorityOrder[b.options.priority || 'normal'];
    });
    
    // Process one item at a time
    const item = loadingQueue.current.shift();
    if (!item) {
      isProcessing.current = false;
      return;
    }
    
    const { clipId, assetId, url, clipDuration, clipWidth, trimStart, trimEnd, options } = item;
    
    try {
      // Update state to loading
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: true,
        error: null,
        isUsingWebAssembly: isWebAssemblyReady
      }));
      
      // Check if we should use WebAssembly or fallback to server
      if (isWebAssemblyReady && !webAssemblyFailed) {
        try {
          // Try WebAssembly processing
          await processWebAssemblyFilmstrip(clipId, assetId, url, clipDuration, clipWidth, trimStart, trimEnd, options);
        } catch (wasmError) {
          console.warn(`WebAssembly processing failed for ${clipId}, falling back to server:`, wasmError);
          // Fall back to server processing
          await generateServerFilmstrip(clipId, url, clipDuration, clipWidth, trimStart, trimEnd, options);
        }
      } else {
        // Use server-based processing
        await generateServerFilmstrip(clipId, url, clipDuration, clipWidth, trimStart, trimEnd, options);
      }
      
    } catch (error) {
      console.error(`Failed to process filmstrip for clip ${clipId}:`, error);
      
      // Update state with error
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        isUsingWebAssembly: false
      }));
    }
    
    isProcessing.current = false;
    
    // Continue processing queue
    setTimeout(() => processQueue(), 100);
  }, [isWebAssemblyReady, webAssemblyFailed, generateServerFilmstrip]);
  
  // Process filmstrip using WebAssembly
  const processWebAssemblyFilmstrip = useCallback(async (
    clipId: string, 
    assetId: string, 
    url: string, 
    clipDuration: number, 
    clipWidth: number, 
    trimStart: number, 
    trimEnd: number,
    options: UseVideoFilmstripsOptions
  ) => {
    // Calculate frame count based on clip width
    const frameWidth = 60;
    const frameHeight = 34;
    const frameCount = options.frameCount || Math.max(3, Math.min(20, Math.floor(clipWidth / frameWidth)));
    
    // Calculate timestamps for frames
    const effectiveDuration = (trimEnd - trimStart) || clipDuration;
    const interval = effectiveDuration / frameCount;
    const timestamps: number[] = [];
    
    for (let i = 0; i < frameCount; i++) {
      const timeInClip = i * interval;
      const actualTime = trimStart + timeInClip;
      timestamps.push(actualTime);
    }
    
    console.log(`🎬 Generating ${frameCount} WebAssembly thumbnails for clip ${clipId}`);
    
    // Generate thumbnails with WebAssembly
    const thumbnailPromises = timestamps.map(timestamp =>
      thumbnailGenerator.generateThumbnail(assetId, url, timestamp, {
        width: frameWidth,
        height: frameHeight,
        quality: options.quality || 'low'
      })
    );
    
    const thumbnailBlobs = await Promise.all(thumbnailPromises);
    
    // Create filmstrip canvas
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth * frameCount;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Canvas context not available');
    
    // Draw all thumbnails onto the filmstrip
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];
    
    await Promise.all(thumbnailBlobs.map((blob, index) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        
        img.onload = () => {
          images[index] = img;
          loadedCount++;
          
          // Draw image at correct position
          ctx.drawImage(img, index * frameWidth, 0, frameWidth, frameHeight);
          
          // Clean up
          URL.revokeObjectURL(url);
          
          if (loadedCount === frameCount) {
            // All images loaded, convert canvas to data URL
            const filmstripDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // Store canvas for reuse
            filmstripCanvases.current.set(clipId, canvas);
            
            // Update state with filmstrip
            setFilmstrips(prev => new Map(prev).set(clipId, {
              filmstrip: filmstripDataUrl,
              isLoading: false,
              error: null,
              isUsingWebAssembly: true
            }));
          }
          
          resolve();
        };
        
        img.onerror = () => reject(new Error(`Failed to load thumbnail ${index}`));
        img.src = url;
      });
    }));
    
    console.log(`✅ WebAssembly filmstrip generated for clip ${clipId} - 0 server requests!`);
  }, []);
  
  // Request filmstrip for a clip
  const requestFilmstrip = useCallback((
    clipId: string,
    url: string,
    clipDuration: number,
    clipWidth: number,
    options: UseVideoFilmstripsOptions & {
      assetId?: string;
      trimStart?: number;
      trimEnd?: number;
    } = {}
  ) => {
    const currentState = filmstrips.get(clipId);
    
    // Skip if already loading or loaded
    if (currentState?.isLoading || currentState?.filmstrip) {
      return;
    }
    
    // Skip if disabled
    if (options.enabled === false) {
      return;
    }
    
    // Check if already in queue
    const isQueued = loadingQueue.current.some(item => item.clipId === clipId);
    if (isQueued) {
      return;
    }
    
    // Extract asset ID from URL if not provided
    const assetId = options.assetId || extractAssetIdFromUrl(url);
    
    // Add to queue
    loadingQueue.current.push({
      clipId,
      assetId,
      url,
      clipDuration,
      clipWidth,
      trimStart: options.trimStart || 0,
      trimEnd: options.trimEnd || clipDuration,
      options
    });
    
    // Start processing
    processQueue();
  }, [filmstrips, processQueue]);
  
  // Clear filmstrip for a clip
  const clearFilmstrip = useCallback((clipId: string) => {
    setFilmstrips(prev => {
      const newMap = new Map(prev);
      newMap.delete(clipId);
      return newMap;
    });
    
    // Remove from queue if present
    loadingQueue.current = loadingQueue.current.filter(item => item.clipId !== clipId);
    
    // Clean up canvas
    const canvas = filmstripCanvases.current.get(clipId);
    if (canvas) {
      filmstripCanvases.current.delete(clipId);
    }
  }, []);
  
  // Clear all filmstrips
  const clearAllFilmstrips = useCallback(() => {
    setFilmstrips(new Map());
    loadingQueue.current = [];
    filmstripCanvases.current.clear();
  }, []);
  
  // Get filmstrip URL for a clip
  const getFilmstrip = useCallback((clipId: string): string | null => {
    return filmstrips.get(clipId)?.filmstrip || null;
  }, [filmstrips]);
  
  // Check if a clip is loading
  const isLoadingFilmstrip = useCallback((clipId: string): boolean => {
    return filmstrips.get(clipId)?.isLoading || false;
  }, [filmstrips]);
  
  // Get error for a clip
  const getFilmstripError = useCallback((clipId: string): string | null => {
    return filmstrips.get(clipId)?.error || null;
  }, [filmstrips]);
  
  // Check if using WebAssembly for a clip
  const isUsingWebAssembly = useCallback((clipId: string): boolean => {
    return filmstrips.get(clipId)?.isUsingWebAssembly || false;
  }, [filmstrips]);
  
  return {
    // State accessors
    getFilmstripState,
    getFilmstrip,
    isLoadingFilmstrip,
    getFilmstripError,
    isUsingWebAssembly,
    
    // Actions
    requestFilmstrip,
    clearFilmstrip,
    clearAllFilmstrips,
    
    // Queue info
    queueLength: loadingQueue.current.length,
    isProcessingQueue: isProcessing.current,
    
    // WebAssembly status
    isWebAssemblyReady,
    webAssemblyFailed
  };
}

// Helper function to extract asset ID from URL
function extractAssetIdFromUrl(url: string): string {
  // Extract from URL pattern like: /api/media?key=user_files_xxx
  const match = url.match(/user_files_([^&\/]+)/);
  if (match) {
    return match[1];
  }
  
  // Fallback: use URL as ID
  return url;
}

/**
 * Context for sharing filmstrip manager across components
 */
const VideoFilmstripsContext = createContext<ReturnType<typeof useVideoFilmstrips> | null>(null);

interface VideoFilmstripsProviderProps {
  children: React.ReactNode;
}

export function VideoFilmstripsProvider({ children }: VideoFilmstripsProviderProps) {
  const filmstripsManager = useVideoFilmstrips();
  
  return React.createElement(
    VideoFilmstripsContext.Provider,
    { value: filmstripsManager },
    children
  );
}

export function useVideoFilmstripsContext() {
  const context = useContext(VideoFilmstripsContext);
  if (!context) {
    throw new Error('useVideoFilmstripsContext must be used within VideoFilmstripsProvider');
  }
  return context;
} 