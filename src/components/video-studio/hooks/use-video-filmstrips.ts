import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { 
  createCachedVideoFilmstrip, 
  type FilmstripConfig,
  DEFAULT_FILMSTRIP_CONFIG 
} from '../lib/media-utils';

interface VideoFilmstripState {
  filmstrip: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseVideoFilmstripsOptions {
  config?: Partial<FilmstripConfig>;
  enabled?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Hook for managing video filmstrips in timeline clips
 * Implements professional video editor loading strategies
 */
export function useVideoFilmstrips() {
  const [filmstrips, setFilmstrips] = useState<Map<string, VideoFilmstripState>>(new Map());
  const loadingQueue = useRef<Array<{ clipId: string; url: string; clipDuration: number; clipWidth: number; options: UseVideoFilmstripsOptions }>>([]);
  const isProcessing = useRef(false);
  
  // Get filmstrip state for a specific clip
  const getFilmstripState = useCallback((clipId: string): VideoFilmstripState => {
    return filmstrips.get(clipId) || {
      filmstrip: null,
      isLoading: false,
      error: null
    };
  }, [filmstrips]);
  
  // Process the loading queue
  const processQueue = useCallback(async () => {
    if (isProcessing.current || loadingQueue.current.length === 0) {
      return;
    }
    
    isProcessing.current = true;
    
    // Sort queue by priority (high -> normal -> low)
    loadingQueue.current.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.options.priority || 'normal'] - priorityOrder[b.options.priority || 'normal'];
    });
    
    // Process one item at a time to prevent browser overload
    const item = loadingQueue.current.shift();
    if (!item) {
      isProcessing.current = false;
      return;
    }
    
    const { clipId, url, clipDuration, clipWidth, options } = item;
    
    try {
      // Update state to loading
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: true,
        error: null
      }));
      
      // Generate filmstrip
      const filmstrip = await createCachedVideoFilmstrip(
        url,
        clipDuration,
        clipWidth,
        options.config
      );
      
      // Update state with filmstrip
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip,
        isLoading: false,
        error: null
      }));
      
    } catch (error) {
      console.warn(`Failed to generate filmstrip for clip ${clipId}:`, error);
      
      // Update state with error
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
    
    isProcessing.current = false;
    
    // Continue processing queue
    setTimeout(() => processQueue(), 100); // Small delay to prevent blocking
  }, []);
  
  // Request filmstrip for a clip
  const requestFilmstrip = useCallback((
    clipId: string,
    url: string,
    clipDuration: number,
    clipWidth: number,
    options: UseVideoFilmstripsOptions = {}
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
    
    // Add to queue
    loadingQueue.current.push({
      clipId,
      url,
      clipDuration,
      clipWidth,
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
  }, []);
  
  // Clear all filmstrips
  const clearAllFilmstrips = useCallback(() => {
    setFilmstrips(new Map());
    loadingQueue.current = [];
  }, []);
  
  // Get filmstrip URL for a clip (convenience method)
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

/**
 * Hook for a single video clip filmstrip
 * Simpler interface for individual clips
 */
export function useVideoFilmstrip(
  clipId: string,
  url: string,
  clipDuration: number,
  clipWidth: number,
  options: UseVideoFilmstripsOptions = {}
) {
  const filmstripsManager = useVideoFilmstrips();
  
  // Request filmstrip when dependencies change
  useEffect(() => {
    if (url && clipDuration > 0 && clipWidth > 0) {
      filmstripsManager.requestFilmstrip(clipId, url, clipDuration, clipWidth, options);
    }
  }, [clipId, url, clipDuration, clipWidth, options.enabled, filmstripsManager]);
  
  // Cleanup when unmounting
  useEffect(() => {
    return () => {
      filmstripsManager.clearFilmstrip(clipId);
    };
  }, [clipId, filmstripsManager]);
  
  const state = filmstripsManager.getFilmstripState(clipId);
  
  return {
    filmstrip: state.filmstrip,
    isLoading: state.isLoading,
    error: state.error
  };
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