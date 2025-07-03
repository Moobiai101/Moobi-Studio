import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { thumbnailGenerator } from '@/lib/video-processing/wasm-thumbnail-generator';
import { storageOrchestrator } from '@/lib/storage/storage-orchestrator';

interface VideoFilmstripState {
  filmstrip: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseVideoFilmstripsOptions {
  frameCount?: number;
  enabled?: boolean;
  priority?: 'high' | 'normal' | 'low';
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Hook for managing video filmstrips using WebAssembly
 * Eliminates server requests and provides instant cached thumbnails
 */
export function useVideoFilmstrips() {
  const [filmstrips, setFilmstrips] = useState<Map<string, VideoFilmstripState>>(new Map());
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
  
  // Initialize WebAssembly thumbnail generator
  useEffect(() => {
    thumbnailGenerator.initialize().catch(console.error);
  }, []);
  
  // Get filmstrip state for a specific clip
  const getFilmstripState = useCallback((clipId: string): VideoFilmstripState => {
    return filmstrips.get(clipId) || {
      filmstrip: null,
      isLoading: false,
      error: null
    };
  }, [filmstrips]);
  
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
        error: null
      }));
      
      // Calculate frame count based on clip width
      const frameWidth = 60; // Frame width
      const frameHeight = 34; // Frame height
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
          quality: options.quality || 'low' // Low quality for timeline
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
                error: null
              }));
            }
            
            resolve();
          };
          
          img.onerror = () => reject(new Error(`Failed to load thumbnail ${index}`));
          img.src = url;
        });
      }));
      
      console.log(`✅ WebAssembly filmstrip generated for clip ${clipId} - 0 server requests!`);
      
    } catch (error) {
      console.warn(`Failed to generate WebAssembly filmstrip for clip ${clipId}:`, error);
      
      // Update state with error
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
    
    isProcessing.current = false;
    
    // Continue processing queue
    setTimeout(() => processQueue(), 100);
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
  
  return {
    // State accessors
    getFilmstripState,
    getFilmstrip,
    isLoadingFilmstrip,
    getFilmstripError,
    
    // Actions
    requestFilmstrip,
    clearFilmstrip,
    clearAllFilmstrips,
    
    // Queue info
    queueLength: loadingQueue.current.length,
    isProcessingQueue: isProcessing.current
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