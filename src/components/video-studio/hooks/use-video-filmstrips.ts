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
  lastRequestTime?: number;
  retryCount?: number;
}

interface UseVideoFilmstripsOptions {
  config?: Partial<FilmstripConfig>;
  enabled?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

// Global constants for request management
const MAX_CONCURRENT_REQUESTS = 2; // Reduced from 3 to be more conservative
const MAX_RETRIES_PER_CLIP = 1; // Reduced from 2 to prevent excessive retries
const RETRY_DELAY_MS = 10000; // Increased to 10 seconds
const DEBOUNCE_DELAY_MS = 200; // Increased to 200ms for better debouncing
const REQUEST_TIMEOUT_MS = 20000; // Increased to 20 seconds
const RATE_LIMIT_INTERVAL_MS = 500; // Minimum time between new requests
const MAX_QUEUE_SIZE = 20; // Maximum queue size to prevent memory issues

/**
 * Hook for managing video filmstrips in timeline clips
 * Implements professional video editor loading strategies with comprehensive throttling
 */
export function useVideoFilmstrips() {
  const [filmstrips, setFilmstrips] = useState<Map<string, VideoFilmstripState>>(new Map());
  const loadingQueue = useRef<Array<{ clipId: string; url: string; clipDuration: number; clipWidth: number; options: UseVideoFilmstripsOptions }>>([]);
  const isProcessing = useRef(false);
  const activeRequests = useRef(new Set<string>());
  const requestTimeouts = useRef(new Map<string, NodeJS.Timeout>());
  const retryTimeouts = useRef(new Map<string, NodeJS.Timeout>());
  const lastRequestTime = useRef(0);
  
  // Get filmstrip state for a specific clip
  const getFilmstripState = useCallback((clipId: string): VideoFilmstripState => {
    return filmstrips.get(clipId) || {
      filmstrip: null,
      isLoading: false,
      error: null,
      lastRequestTime: 0,
      retryCount: 0
    };
  }, [filmstrips]);
  
  // Generate cache key for deduplication
  const getCacheKey = useCallback((url: string, config: Partial<FilmstripConfig>) => {
    return `${url}:${JSON.stringify(config)}`;
  }, []);
  
  // Clear timeouts for a clip
  const clearTimeoutsForClip = useCallback((clipId: string) => {
    const requestTimeout = requestTimeouts.current.get(clipId);
    if (requestTimeout) {
      clearTimeout(requestTimeout);
      requestTimeouts.current.delete(clipId);
    }
    
    const retryTimeout = retryTimeouts.current.get(clipId);
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeouts.current.delete(clipId);
    }
  }, []);
  
  // Process the loading queue with enhanced throttling
  const processQueue = useCallback(async () => {
    if (isProcessing.current || loadingQueue.current.length === 0) {
      return;
    }
    
    // Rate limiting: ensure minimum time between requests
    const now = Date.now();
    if (now - lastRequestTime.current < RATE_LIMIT_INTERVAL_MS) {
      setTimeout(() => processQueue(), RATE_LIMIT_INTERVAL_MS - (now - lastRequestTime.current));
      return;
    }
    
    // Limit concurrent requests
    if (activeRequests.current.size >= MAX_CONCURRENT_REQUESTS) {
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
    
    // Check if already processing this clip
    if (activeRequests.current.has(clipId)) {
      isProcessing.current = false;
      setTimeout(() => processQueue(), DEBOUNCE_DELAY_MS);
      return;
    }
    
    // Update last request time for rate limiting
    lastRequestTime.current = now;
    activeRequests.current.add(clipId);
    
    try {
      // Update state to loading
      setFilmstrips(prev => {
        const currentState = prev.get(clipId) || { filmstrip: null, isLoading: false, error: null, retryCount: 0 };
        return new Map(prev).set(clipId, {
          ...currentState,
          isLoading: true,
          error: null,
          lastRequestTime: now
        });
      });
      
      // Set timeout for this request
      const timeoutId = setTimeout(() => {
        console.warn(`Filmstrip request timeout for clip ${clipId}`);
        activeRequests.current.delete(clipId);
        setFilmstrips(prev => {
          const currentState = prev.get(clipId);
          if (currentState) {
            return new Map(prev).set(clipId, {
              ...currentState,
              isLoading: false,
              error: 'Request timeout'
            });
          }
          return prev;
        });
      }, REQUEST_TIMEOUT_MS);
      
      requestTimeouts.current.set(clipId, timeoutId);
      
      // Generate filmstrip with error handling
      const filmstrip = await createCachedVideoFilmstrip(
        url,
        clipDuration,
        clipWidth,
        options.config
      );
      
      // Clear timeout since request succeeded
      clearTimeoutsForClip(clipId);
      activeRequests.current.delete(clipId);
      
      // Update state with filmstrip
      setFilmstrips(prev => new Map(prev).set(clipId, {
        filmstrip,
        isLoading: false,
        error: null,
        lastRequestTime: now,
        retryCount: 0
      }));
      
      console.log(`Successfully generated filmstrip for clip ${clipId}`);
      
    } catch (error) {
      clearTimeoutsForClip(clipId);
      activeRequests.current.delete(clipId);
      
      const currentState = filmstrips.get(clipId);
      const retryCount = (currentState?.retryCount || 0) + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.warn(`Failed to generate filmstrip for clip ${clipId} (attempt ${retryCount}):`, error);
      
      // Don't retry for certain error types
      const shouldNotRetry = errorMessage.includes('CORS') || 
                            errorMessage.includes('cross-origin') ||
                            errorMessage.includes('not accessible') ||
                            errorMessage.includes('Malformed') ||
                            errorMessage.includes('Invalid');
      
      if (retryCount <= MAX_RETRIES_PER_CLIP && !shouldNotRetry) {
        // Schedule retry for recoverable errors
        const retryTimeout = setTimeout(() => {
          console.log(`Retrying filmstrip generation for clip ${clipId} (attempt ${retryCount + 1})`);
          // Only retry if queue isn't full
          if (loadingQueue.current.length < MAX_QUEUE_SIZE) {
            loadingQueue.current.push({ clipId, url, clipDuration, clipWidth, options });
            processQueue();
          }
        }, RETRY_DELAY_MS * retryCount); // Exponential backoff
        
        retryTimeouts.current.set(clipId, retryTimeout);
        
        setFilmstrips(prev => new Map(prev).set(clipId, {
          filmstrip: null,
          isLoading: false,
          error: `Retrying... (${retryCount}/${MAX_RETRIES_PER_CLIP})`,
          lastRequestTime: now,
          retryCount
        }));
      } else {
        // Max retries reached or permanent error - give up
        const finalError = shouldNotRetry 
          ? (errorMessage.includes('CORS') ? 'Video blocked by CORS policy' : errorMessage)
          : `Failed after ${MAX_RETRIES_PER_CLIP} attempts`;
          
        setFilmstrips(prev => new Map(prev).set(clipId, {
          filmstrip: null,
          isLoading: false,
          error: finalError,
          lastRequestTime: now,
          retryCount
        }));
      }
    }
    
    isProcessing.current = false;
    
    // Continue processing queue with controlled delay
    setTimeout(() => processQueue(), DEBOUNCE_DELAY_MS);
  }, [filmstrips, clearTimeoutsForClip]);
  
  // Request filmstrip for a clip with comprehensive validation
  const requestFilmstrip = useCallback((
    clipId: string,
    url: string,
    clipDuration: number,
    clipWidth: number,
    options: UseVideoFilmstripsOptions = {}
  ) => {
    // Validate inputs
    if (!clipId || !url || clipDuration <= 0 || clipWidth <= 0) {
      console.warn('Invalid filmstrip request parameters:', { clipId, url, clipDuration, clipWidth });
      return;
    }
    
    const currentState = filmstrips.get(clipId);
    
    // Skip if already loading or loaded
    if (currentState?.isLoading || currentState?.filmstrip) {
      return;
    }
    
    // Skip if disabled
    if (options.enabled === false) {
      return;
    }
    
    // Skip if too many recent failures
    if (currentState?.retryCount && currentState.retryCount >= MAX_RETRIES_PER_CLIP) {
      return;
    }
    
    // Skip if recently failed and still in cooldown
    if (currentState?.error && currentState.lastRequestTime) {
      const timeSinceLastRequest = Date.now() - currentState.lastRequestTime;
      if (timeSinceLastRequest < RETRY_DELAY_MS) {
        return;
      }
    }
    
    // Check if already in queue
    const isQueued = loadingQueue.current.some(item => item.clipId === clipId);
    if (isQueued) {
      return;
    }
    
    // Check if actively processing
    if (activeRequests.current.has(clipId)) {
      return;
    }
    
    // Check queue size limit
    if (loadingQueue.current.length >= MAX_QUEUE_SIZE) {
      console.warn(`Queue full (${MAX_QUEUE_SIZE}), skipping filmstrip request for clip ${clipId}`);
      return;
    }
    
    // Add to queue with deduplication
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
    clearTimeoutsForClip(clipId);
    activeRequests.current.delete(clipId);
    
    setFilmstrips(prev => {
      const newMap = new Map(prev);
      newMap.delete(clipId);
      return newMap;
    });
    
    // Remove from queue if present
    loadingQueue.current = loadingQueue.current.filter(item => item.clipId !== clipId);
  }, [clearTimeoutsForClip]);
  
  // Clear all filmstrips
  const clearAllFilmstrips = useCallback(() => {
    // Clear all timeouts
    requestTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    requestTimeouts.current.clear();
    retryTimeouts.current.clear();
    activeRequests.current.clear();
    
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
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllFilmstrips();
    };
  }, [clearAllFilmstrips]);
  
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
    isProcessingQueue: isProcessing.current,
    activeRequestCount: activeRequests.current.size
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