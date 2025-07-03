// Storage Orchestrator - Central management for three-tier storage architecture
// Manages: IndexedDB (cache) ↔ Supabase (database) ↔ R2 (file storage)

import { cacheDB } from './indexeddb-cache';
import { createClient } from '@/lib/supabase/client';
import { VideoEditorProject, UserAsset, ProjectData, ExportHistory } from '@/types/database';
import { MediaAssetService } from '@/services/media-assets';

const supabase = createClient();

interface StorageStrategy {
  preferCache: boolean;
  cacheExpiry: number;
  fallbackToRemote: boolean;
  syncToCloud: boolean;
}

interface PerformanceMetrics {
  cacheHitRate: number;
  averageLoadTime: number;
  dataTransferred: number;
  lastOptimization: number;
}

export class StorageOrchestrator {
  private static instance: StorageOrchestrator;
  private isInitialized = false;
  private performanceMetrics: PerformanceMetrics;

  private constructor() {
    this.performanceMetrics = {
      cacheHitRate: 0,
      averageLoadTime: 0,
      dataTransferred: 0,
      lastOptimization: Date.now()
    };
  }

  static getInstance(): StorageOrchestrator {
    if (!StorageOrchestrator.instance) {
      StorageOrchestrator.instance = new StorageOrchestrator();
    }
    return StorageOrchestrator.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize IndexedDB cache
      await cacheDB.init();
      
      // Clean up expired cache data
      await cacheDB.clearExpiredData();
      
      // Log initialization performance
      await cacheDB.logPerformance('storage_init', 0, {
        timestamp: Date.now(),
        cacheSize: await cacheDB.getCacheSize()
      });

      this.isInitialized = true;
      console.log('Storage Orchestrator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Storage Orchestrator:', error);
      throw error;
    }
  }

  // === PROJECT MANAGEMENT ===
  
  /**
   * Load project with intelligent caching strategy
   * 1. Check IndexedDB cache first
   * 2. Fall back to Supabase if cache miss or expired
   * 3. Cache the result for future access
   */
  async loadProject(projectId: string): Promise<VideoEditorProject | null> {
    const startTime = Date.now();

    try {
      // Try cache first
      const cachedProject = await cacheDB.getCachedProject(projectId);
      
      if (cachedProject) {
        const cacheAge = Date.now() - cachedProject.lastModified;
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          await this.logPerformance('project_load_cache', Date.now() - startTime);
          this.updateCacheHitRate(true);
          return cachedProject.projectData;
        }
      }

      // Load from Supabase
      const { data, error } = await supabase
        .from('video_editor_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      if (!data) return null;

      // Cache the project for future access
      await cacheDB.cacheProject({
        projectId: data.id,
        projectData: data,
        thumbnails: [], // Will be populated as thumbnails are loaded
        lastModified: Date.now()
      });

      await this.logPerformance('project_load_remote', Date.now() - startTime);
      this.updateCacheHitRate(false);
      return data;

    } catch (error) {
      console.error('Failed to load project:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await cacheDB.logPerformance('project_load_error', Date.now() - startTime, { error: errorMessage });
      return null;
    }
  }

  /**
   * Save project with optimized strategy
   * 1. Save to cache immediately (for responsiveness)
   * 2. Debounced save to Supabase (for persistence)
   * 3. Sync status tracking
   */
  async saveProject(projectId: string, projectData: ProjectData, immediate = false): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Always update cache immediately for responsiveness
      await cacheDB.cacheProject({
        projectId,
        projectData: projectData as any,
        thumbnails: [],
        lastModified: Date.now()
      });

      // Save to Supabase
      const { error } = await supabase
        .from('video_editor_projects')
        .update({
          project_data: projectData,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;

      await this.logPerformance('project_save', Date.now() - startTime);
      return true;

    } catch (error) {
      console.error('Failed to save project:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await cacheDB.logPerformance('project_save_error', Date.now() - startTime, { error: errorMessage });
      return false;
    }
  }

  // === ASSET MANAGEMENT ===

  /**
   * Load asset with caching strategy
   * Prioritizes thumbnails and metadata from cache
   */
  async loadAsset(assetId: string): Promise<UserAsset | null> {
    const startTime = Date.now();

    try {
      // Get asset metadata from Supabase
      const { data, error } = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (error) throw error;
      if (!data) return null;

      await this.logPerformance('asset_load', Date.now() - startTime);
      return data;

    } catch (error) {
      console.error('Failed to load asset:', error);
      return null;
    }
  }

  /**
   * Get asset URL with caching consideration
   * Returns cached blob URL if available, otherwise generates R2 URL
   */
  getAssetUrl(asset: UserAsset, useCache = true): string {
    // For now, always use R2 URL through the worker
    // In future WebAssembly phases, we'll implement blob URL caching
    return MediaAssetService.getAssetUrl(asset.r2_object_key);
  }

  // === THUMBNAIL MANAGEMENT ===

  async getThumbnail(assetId: string, timestamp: number): Promise<Blob | null> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cachedThumbnail = await cacheDB.getThumbnail(assetId, timestamp);
      
      if (cachedThumbnail) {
        await this.logPerformance('thumbnail_load_cache', Date.now() - startTime);
        this.updateCacheHitRate(true);
        return cachedThumbnail.blob;
      }

      // If not in cache, we'll need to generate it
      // This will be implemented in Phase 2 with WebAssembly
      await this.logPerformance('thumbnail_load_miss', Date.now() - startTime);
      this.updateCacheHitRate(false);
      return null;

    } catch (error) {
      console.error('Failed to get thumbnail:', error);
      return null;
    }
  }

  async storeThumbnail(assetId: string, timestamp: number, blob: Blob, dimensions: { width: number; height: number }): Promise<void> {
    try {
      await cacheDB.storeThumbnail({
        assetId,
        timeStamp: timestamp,
        blob,
        width: dimensions.width,
        height: dimensions.height
      });
    } catch (error) {
      console.error('Failed to store thumbnail:', error);
    }
  }

  // === WAVEFORM MANAGEMENT ===

  async getWaveform(assetId: string): Promise<Float32Array | null> {
    const startTime = Date.now();

    try {
      const cachedWaveform = await cacheDB.getWaveform(assetId);
      
      if (cachedWaveform) {
        await this.logPerformance('waveform_load_cache', Date.now() - startTime);
        this.updateCacheHitRate(true);
        return cachedWaveform.peaks;
      }

      // Generate waveform if not cached (Phase 2 implementation)
      this.updateCacheHitRate(false);
      return null;

    } catch (error) {
      console.error('Failed to get waveform:', error);
      return null;
    }
  }

  async storeWaveform(assetId: string, peaks: Float32Array, duration: number, sampleRate: number): Promise<void> {
    try {
      await cacheDB.storeWaveform({
        assetId,
        peaks,
        duration,
        sampleRate
      });
    } catch (error) {
      console.error('Failed to store waveform:', error);
    }
  }

  // === EXPORT MANAGEMENT (NO R2 STORAGE) ===

  /**
   * Track export without storing files
   * Exports are tracked in database but files are only provided as downloads
   */
  async trackExport(
    projectId: string,
    exportSettings: any,
    webassemblyUsed: boolean = false
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('export_history')
        .insert({
          project_id: projectId,
          user_id: user.id,
          export_settings: exportSettings,
          export_status: 'queued',
          progress_percentage: 0,
          download_count: 0,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          webassembly_used: webassemblyUsed
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;

    } catch (error) {
      console.error('Failed to track export:', error);
      throw error;
    }
  }

  async updateExportProgress(exportId: string, progress: number, status?: string): Promise<void> {
    try {
      const updates: any = { progress_percentage: progress };
      if (status) updates.export_status = status;

      const { error } = await supabase
        .from('export_history')
        .update(updates)
        .eq('id', exportId);

      if (error) throw error;

    } catch (error) {
      console.error('Failed to update export progress:', error);
    }
  }

  // === PERFORMANCE MONITORING ===

  private async logPerformance(operation: string, duration: number, metadata?: any): Promise<void> {
    try {
      await cacheDB.logPerformance(operation, duration, metadata);
      this.updatePerformanceMetrics(operation, duration);
    } catch (error) {
      console.error('Failed to log performance:', error);
    }
  }

  private updatePerformanceMetrics(operation: string, duration: number): void {
    // Update average load time
    this.performanceMetrics.averageLoadTime = 
      (this.performanceMetrics.averageLoadTime + duration) / 2;
  }

  private updateCacheHitRate(hit: boolean): void {
    // Simple cache hit rate calculation
    this.performanceMetrics.cacheHitRate = 
      (this.performanceMetrics.cacheHitRate * 0.9) + (hit ? 0.1 : 0);
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return { ...this.performanceMetrics };
  }

  async getCacheStatus(): Promise<any> {
    return await cacheDB.getCacheSize();
  }

  // === CACHE MANAGEMENT ===

  async optimizeCache(): Promise<void> {
    try {
      // Clear expired data
      await cacheDB.clearExpiredData();

      // Check cache size and clear if too large
      const cacheSize = await cacheDB.getCacheSize();
      const totalSize = Object.values(cacheSize).reduce((sum, size) => sum + size, 0);

      // If cache is over 100MB, clear oldest frames
      if (totalSize > 100 * 1024 * 1024) {
        await cacheDB.clearStore('frames');
      }

      this.performanceMetrics.lastOptimization = Date.now();

    } catch (error) {
      console.error('Failed to optimize cache:', error);
    }
  }

  async clearCache(): Promise<void> {
    try {
      await cacheDB.clearAllCache();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // === DEVICE CAPABILITIES ===

  async detectDeviceCapabilities(): Promise<any> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      // Server-side defaults
      return {
        capabilities: {
          webassembly_supported: false,
          simd_supported: false,
          memory_gb: 4,
          cpu_cores: 4,
          gpu_acceleration: false,
          max_video_resolution: '1080p',
          supported_codecs: ['h264', 'vp8', 'vp9']
        },
        performance_profile: {
          benchmark_score: 5,
          recommended_quality: 'medium',
          max_concurrent_jobs: 2,
          cache_size_mb: 200
        },
        browser_info: {
          name: 'Unknown',
          version: 'unknown',
          features_supported: []
        }
      };
    }

    const capabilities = {
      webassembly_supported: typeof WebAssembly !== 'undefined',
      simd_supported: false, // Will be detected in Phase 2
      memory_gb: (navigator as any).deviceMemory || 4, // Estimate
      cpu_cores: navigator.hardwareConcurrency || 4,
      gpu_acceleration: false, // Will be detected in Phase 2
      max_video_resolution: '1080p', // Conservative default
      supported_codecs: ['h264', 'vp8', 'vp9'] // Will be detected dynamically
    };

    // Benchmark basic performance
    const benchmarkStart = Date.now();
    // Simple CPU benchmark
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i);
    }
    const benchmarkTime = Date.now() - benchmarkStart;

    const performanceProfile = {
      benchmark_score: Math.max(1, Math.min(10, 10 - (benchmarkTime / 100))),
      recommended_quality: benchmarkTime < 100 ? 'high' : benchmarkTime < 300 ? 'medium' : 'low',
      max_concurrent_jobs: Math.min(capabilities.cpu_cores, 4),
      cache_size_mb: Math.min(capabilities.memory_gb * 100, 500) // 100MB per GB, max 500MB
    };

    return {
      capabilities,
      performance_profile: performanceProfile,
      browser_info: {
        name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other',
        version: 'unknown',
        features_supported: ['WebAssembly', 'IndexedDB', 'WebWorkers']
      }
    };
  }
}

// Export singleton instance
export const storageOrchestrator = StorageOrchestrator.getInstance(); 