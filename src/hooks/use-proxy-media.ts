/**
 * Proxy Media Hook
 * 
 * Handles proxy generation, loading, and smart quality switching
 * for optimal timeline performance in the video studio
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { proxyMediaEngine, getOptimalProxyQuality } from '@/lib/proxy-media/proxy-media-engine';
import { toast } from 'sonner';

interface ProxyMediaState {
  isGenerating: boolean;
  generationProgress: number;
  availableQualities: Array<'low' | 'medium' | 'high'>;
  currentQuality: 'low' | 'medium' | 'high';
  proxyUrl?: string;
  filmstripUrl?: string;
  error?: string;
}

interface UseProxyMediaOptions {
  assetFingerprint: string;
  originalFile?: Blob;
  filename?: string;
  autoGenerate?: boolean;
  preferredQuality?: 'low' | 'medium' | 'high';
}

interface UseProxyMediaReturn {
  proxyState: ProxyMediaState;
  generateProxy: (qualities?: Array<'low' | 'medium' | 'high'>) => Promise<void>;
  loadProxy: (quality: 'low' | 'medium' | 'high') => Promise<string | null>;
  loadFilmstrip: () => Promise<string | null>;
  switchQuality: (quality: 'low' | 'medium' | 'high') => Promise<void>;
  getOptimalQuality: (timelineZoom?: number) => 'low' | 'medium' | 'high';
  cancelGeneration: () => void;
}

/**
 * Hook for proxy media management
 */
export function useProxyMedia(options: UseProxyMediaOptions): UseProxyMediaReturn {
  const {
    assetFingerprint,
    originalFile,
    filename,
    autoGenerate = true,
    preferredQuality = 'medium',
  } = options;

  const [proxyState, setProxyState] = useState<ProxyMediaState>({
    isGenerating: false,
    generationProgress: 0,
    availableQualities: [],
    currentQuality: preferredQuality,
  });

  const activeJobRef = useRef<string | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  /**
   * Generate proxy media
   */
     const generateProxy = useCallback(async (
     qualities?: Array<'low' | 'medium' | 'high'>
   ) => {
    if (!originalFile || !filename) {
      console.warn('Cannot generate proxy: missing originalFile or filename');
      return;
    }

    try {
      setProxyState(prev => ({
        ...prev,
        isGenerating: true,
        generationProgress: 0,
        error: undefined,
      }));

      // Queue proxy generation
      const jobId = await proxyMediaEngine.queueProxyGeneration(
        assetFingerprint,
        originalFile,
        filename,
        qualities
      );

      activeJobRef.current = jobId;

      // Monitor progress
      const progressInterval = setInterval(() => {
        const job = proxyMediaEngine.getJobStatus(jobId);
        if (!job) {
          clearInterval(progressInterval);
          return;
        }

        setProxyState(prev => ({
          ...prev,
          generationProgress: job.progress,
        }));

        if (job.status === 'completed') {
          clearInterval(progressInterval);
          setProxyState(prev => ({
            ...prev,
            isGenerating: false,
            generationProgress: 100,
            availableQualities: job.qualities,
          }));

          toast.success(`🎬 Proxy generation completed for ${filename}`);
        } else if (job.status === 'failed') {
          clearInterval(progressInterval);
          setProxyState(prev => ({
            ...prev,
            isGenerating: false,
            error: job.error || 'Proxy generation failed',
          }));

          toast.error(`❌ Proxy generation failed for ${filename}`);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to generate proxy:', error);
      setProxyState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [assetFingerprint, originalFile, filename]);

  /**
   * Load proxy media for a specific quality
   */
     const loadProxy = useCallback(async (
     quality: 'low' | 'medium' | 'high'
   ): Promise<string | null> => {
    try {
      // Check cache first
      const cacheKey = `${assetFingerprint}_${quality}`;
      const cachedUrl = urlCacheRef.current.get(cacheKey);
      if (cachedUrl) return cachedUrl;

      // Load from IndexedDB
      const proxyBlob = await proxyMediaEngine.getProxyMedia(assetFingerprint, quality);
      if (!proxyBlob) return null;

      // Create URL and cache it
      const proxyUrl = URL.createObjectURL(proxyBlob);
      urlCacheRef.current.set(cacheKey, proxyUrl);

      return proxyUrl;
    } catch (error) {
      console.error('Failed to load proxy media:', error);
      return null;
    }
  }, [assetFingerprint]);

  /**
   * Load filmstrip
   */
  const loadFilmstrip = useCallback(async (): Promise<string | null> => {
    try {
      // Check cache first
      const cacheKey = `${assetFingerprint}_filmstrip`;
      const cachedUrl = urlCacheRef.current.get(cacheKey);
      if (cachedUrl) return cachedUrl;

      // Load from IndexedDB
      const filmstripBlob = await proxyMediaEngine.getFilmstrip(assetFingerprint);
      if (!filmstripBlob) return null;

      // Create URL and cache it
      const filmstripUrl = URL.createObjectURL(filmstripBlob);
      urlCacheRef.current.set(cacheKey, filmstripUrl);

      setProxyState(prev => ({
        ...prev,
        filmstripUrl,
      }));

      return filmstripUrl;
    } catch (error) {
      console.error('Failed to load filmstrip:', error);
      return null;
    }
  }, [assetFingerprint]);

  /**
   * Switch proxy quality
   */
     const switchQuality = useCallback(async (quality: 'low' | 'medium' | 'high') => {
    try {
      const proxyUrl = await loadProxy(quality);
      if (proxyUrl) {
        setProxyState(prev => ({
          ...prev,
          currentQuality: quality,
          proxyUrl,
        }));
      }
    } catch (error) {
      console.error('Failed to switch proxy quality:', error);
    }
  }, [loadProxy]);

  /**
   * Get optimal quality for current conditions
   */
  const getOptimalQuality = useCallback((timelineZoom?: number) => {
    if (!originalFile) return preferredQuality;

    // For this implementation, we'll use a simple approach
    // In production, you'd analyze the original file dimensions
    return getOptimalProxyQuality(1920, 1080, timelineZoom);
  }, [originalFile, preferredQuality]);

  /**
   * Cancel proxy generation
   */
  const cancelGeneration = useCallback(() => {
    if (activeJobRef.current) {
      proxyMediaEngine.cancelJob(activeJobRef.current);
      activeJobRef.current = null;
      
      setProxyState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 0,
        error: 'Cancelled by user',
      }));
    }
  }, []);

  /**
   * Auto-generate proxy on mount if enabled
   */
  useEffect(() => {
    if (autoGenerate && originalFile && filename && !proxyState.isGenerating) {
      generateProxy().catch(console.error);
    }
  }, [autoGenerate, originalFile, filename, generateProxy, proxyState.isGenerating]);

  /**
   * Load initial proxy and filmstrip
   */
  useEffect(() => {
    const loadInitialMedia = async () => {
      // Try to load existing proxy
      const proxyUrl = await loadProxy(proxyState.currentQuality);
      if (proxyUrl) {
        setProxyState(prev => ({
          ...prev,
          proxyUrl,
          availableQualities: prev.availableQualities.includes(proxyState.currentQuality)
            ? prev.availableQualities
            : [...prev.availableQualities, proxyState.currentQuality],
        }));
      }

      // Try to load filmstrip
      await loadFilmstrip();
    };

    loadInitialMedia().catch(console.error);
  }, [assetFingerprint, loadProxy, loadFilmstrip, proxyState.currentQuality]);

  /**
   * Cleanup URLs on unmount
   */
  useEffect(() => {
    return () => {
      // Revoke all cached URLs
      urlCacheRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      urlCacheRef.current.clear();
    };
  }, []);

  return {
    proxyState,
    generateProxy,
    loadProxy,
    loadFilmstrip,
    switchQuality,
    getOptimalQuality,
    cancelGeneration,
  };
}

/**
 * Hook for batch proxy operations
 */
export function useBatchProxyMedia() {
  const [batchState, setBatchState] = useState({
    isProcessing: false,
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
  });

  const generateBatchProxies = useCallback(async (
    assets: Array<{
      fingerprint: string;
      file: Blob;
      filename: string;
             qualities?: Array<'low' | 'medium' | 'high'>;
    }>
  ) => {
    setBatchState({
      isProcessing: true,
      totalJobs: assets.length,
      completedJobs: 0,
      failedJobs: 0,
    });

    try {
      const jobPromises = assets.map(async (asset) => {
        try {
          await proxyMediaEngine.queueProxyGeneration(
            asset.fingerprint,
            asset.file,
            asset.filename,
            asset.qualities
          );
          
          setBatchState(prev => ({
            ...prev,
            completedJobs: prev.completedJobs + 1,
          }));
        } catch (error) {
          console.error(`Failed to queue proxy for ${asset.filename}:`, error);
          setBatchState(prev => ({
            ...prev,
            failedJobs: prev.failedJobs + 1,
          }));
        }
      });

      await Promise.all(jobPromises);
      
      toast.success(`🎬 Queued ${assets.length} proxy generation jobs`);
    } catch (error) {
      console.error('Batch proxy generation failed:', error);
      toast.error('Failed to queue batch proxy generation');
    } finally {
      setBatchState(prev => ({
        ...prev,
        isProcessing: false,
      }));
    }
  }, []);

  const getBatchProgress = useCallback(() => {
    const { totalJobs, completedJobs, failedJobs } = batchState;
    if (totalJobs === 0) return 0;
    return ((completedJobs + failedJobs) / totalJobs) * 100;
  }, [batchState]);

  return {
    batchState,
    generateBatchProxies,
    getBatchProgress,
  };
}

/**
 * Hook for proxy media monitoring
 */
export function useProxyMediaMonitor() {
  const [activeJobs, setActiveJobs] = useState<Array<{
    id: string;
    filename: string;
    progress: number;
    status: string;
  }>>([]);

  const [metrics, setMetrics] = useState({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
  });

  useEffect(() => {
    const updateMonitor = () => {
      const jobs = proxyMediaEngine.getActiveJobs().map(job => ({
        id: job.id,
        filename: job.filename,
        progress: job.progress,
        status: job.status,
      }));

      setActiveJobs(jobs);
      setMetrics(proxyMediaEngine.getMetrics());
    };

    // Update every second
    const interval = setInterval(updateMonitor, 1000);
    updateMonitor(); // Initial update

    return () => clearInterval(interval);
  }, []);

  const clearCompletedJobs = useCallback(() => {
    proxyMediaEngine.clearCompletedJobs();
  }, []);

  return {
    activeJobs,
    metrics,
    clearCompletedJobs,
  };
}

export default useProxyMedia; 