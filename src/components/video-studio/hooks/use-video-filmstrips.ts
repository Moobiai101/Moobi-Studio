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
 * Enhanced hook for managing video filmstrips with robust caching and performance.
 * This version uses a media fingerprint for stable caching, preventing re-renders.
 * It also includes a professional-grade processing queue with prioritization and retry logic.
 */
export function useVideoFilmstrips() {
  const [filmstrips, setFilmstrips] = useState<Map<string, VideoFilmstripState>>(new Map());
  const loadingQueue = useRef<Array<{ clipId: string; mediaFingerprint: string; clipDuration: number; clipWidth: number; options: UseVideoFilmstripsOptions; retryCount?: number }>>([]);
  const isProcessing = useRef(false);
  const failedClips = useRef<Set<string>>(new Set());
  const MAX_RETRIES = 2;
  const PROCESSING_DELAY = 150; // Slightly faster processing

  const getFilmstripState = useCallback((clipId: string): VideoFilmstripState => {
    return filmstrips.get(clipId) || {
      filmstrip: null,
      isLoading: false,
      error: null
    };
  }, [filmstrips]);
  
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
    
    const { clipId, mediaFingerprint, clipDuration, clipWidth, options, retryCount = 0 } = item;
    
    if (failedClips.current.has(clipId)) {
      console.log(`⏭️ Skipping permanently failed clip: ${clipId}`);
      isProcessing.current = false;
      // Continue processing queue after delay
      if (loadingQueue.current.length > 0) {
        setTimeout(() => processQueue(), PROCESSING_DELAY);
      }
      return;
    }

    if (!mediaFingerprint || typeof mediaFingerprint !== 'string' || mediaFingerprint.trim() === '') {
      console.warn(`❌ Invalid fingerprint for clip ${clipId}: ${mediaFingerprint}`);
      failedClips.current.add(clipId);
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: false,
        error: 'Invalid media fingerprint'
      }));
      isProcessing.current = false;
      if (loadingQueue.current.length > 0) {
        setTimeout(() => processQueue(), PROCESSING_DELAY);
      }
      return;
    }
    
    try {
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: true,
        error: null
      }));
      
      console.log(`🎬 Generating filmstrip for clip ${clipId} (fingerprint: ${mediaFingerprint}, attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      
      const filmstripPromise = createCachedVideoFilmstrip(
        mediaFingerprint,
        clipDuration,
        clipWidth,
        options.config
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Filmstrip generation timeout')), 30000);
      });
      
      const filmstrip = await Promise.race([filmstripPromise, timeoutPromise]) as string | null;
      
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip,
        isLoading: false,
        error: null
      }));
      
      console.log(`✅ Filmstrip generated successfully for clip ${clipId}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`❌ Failed to generate filmstrip for clip ${clipId} (attempt ${retryCount + 1}):`, errorMessage);
      
      // Check if we should retry
      if (retryCount < MAX_RETRIES && !errorMessage.includes('net::ERR_FILE_NOT_FOUND')) {
        loadingQueue.current.unshift({
          clipId,
          mediaFingerprint,
          clipDuration,
          clipWidth,
          options,
          retryCount: retryCount + 1
        });
        console.log(`🔄 Retrying filmstrip generation for clip ${clipId}`);
      } else {
        failedClips.current.add(clipId);
        setFilmstrips(prev => new Map(prev).set(clipId, {
          filmstrip: null,
          isLoading: false,
          error: `Failed to generate filmstrip: ${errorMessage}`
        }));
        console.error(`🛑 Permanently failed to generate filmstrip for clip ${clipId} after ${retryCount + 1} attempts`);
      }
    }
    
    isProcessing.current = false;
    
    // Continue processing queue after delay (only if there are items to process)
    if (loadingQueue.current.length > 0) {
      setTimeout(() => processQueue(), PROCESSING_DELAY);
    }
  }, [MAX_RETRIES, PROCESSING_DELAY]);
  
  const requestFilmstrip = useCallback((
    clipId: string,
    mediaFingerprint: string,
    clipDuration: number,
    clipWidth: number,
    options: UseVideoFilmstripsOptions = {}
  ) => {
    if (failedClips.current.has(clipId)) {
      console.log(`⏭️ Skipping filmstrip request for permanently failed clip: ${clipId}`);
      return;
    }

    const currentState = filmstrips.get(clipId);
    
    // Skip if already loading, loaded, or queued
    if (currentState?.isLoading || currentState?.filmstrip) {
      return;
    }

    if (!mediaFingerprint || typeof mediaFingerprint !== 'string' || mediaFingerprint.trim() === '') {
      console.warn(`❌ Invalid fingerprint for filmstrip request ${clipId}: ${mediaFingerprint}`);
      failedClips.current.add(clipId);
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip: null,
        isLoading: false,
        error: 'Invalid media fingerprint'
      }));
      return;
    }
    
    if (options.enabled === false) {
      return;
    }
    
    // Check if already in queue to prevent duplicates
    const isQueued = loadingQueue.current.some(item => item.clipId === clipId);
    if (isQueued) {
      return;
    }
    
    loadingQueue.current.push({
      clipId,
      mediaFingerprint,
      clipDuration,
      clipWidth,
      options
    });
    
    processQueue();
  }, [filmstrips, processQueue]);
  
  const clearFilmstrip = useCallback((clipId: string) => {
    setFilmstrips(prev => {
      const newMap = new Map(prev);
      newMap.delete(clipId);
      return newMap;
    });
    
    // Remove from queue if present
    loadingQueue.current = loadingQueue.current.filter(item => item.clipId !== clipId);
  }, []);
  
  const clearAllFilmstrips = useCallback(() => {
    setFilmstrips(new Map());
    loadingQueue.current = [];
  }, []);
  
  const getFilmstrip = useCallback((clipId: string): string | null => {
    return filmstrips.get(clipId)?.filmstrip || null;
  }, [filmstrips]);
  
  const isLoadingFilmstrip = useCallback((clipId: string): boolean => {
    return filmstrips.get(clipId)?.isLoading || false;
  }, [filmstrips]);
  
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
 * Simplified hook for a single video clip's filmstrip.
 * This hook abstracts away the complexity of the filmstrip manager.
 */
export function useVideoFilmstrip(
  clipId: string,
  mediaFingerprint: string,
  clipDuration: number,
  clipWidth: number,
  options: UseVideoFilmstripsOptions = {}
) {
  const filmstripsManager = useVideoFilmstripsContext();
  
  useEffect(() => {
    if (mediaFingerprint && clipDuration > 0 && clipWidth > 0) {
      filmstripsManager.requestFilmstrip(clipId, mediaFingerprint, clipDuration, clipWidth, options);
    }
  }, [clipId, mediaFingerprint, clipDuration, clipWidth, options.enabled, filmstripsManager]);
  
  useEffect(() => {
    return () => {
      // Note: We might not want to clear the filmstrip on unmount,
      // as it might be needed again soon. This could be a configurable option.
      // filmstripsManager.clearFilmstrip(clipId);
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