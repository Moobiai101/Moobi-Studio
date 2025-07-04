import { createClient } from '@/lib/supabase/client';
import { VideoEditorProject, ProjectData, UserAsset } from '@/types/database';
import { storageOrchestrator } from '@/lib/storage/storage-orchestrator';
import { nanoid } from 'nanoid';

const supabase = createClient();

export class VideoProjectService {
  // Initialize storage on first use
  private static async ensureInitialized(): Promise<void> {
    await storageOrchestrator.initialize();
  }

  // Create a new video project
  static async createProject(title: string = 'Untitled Project'): Promise<VideoEditorProject> {
    await this.ensureInitialized();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const defaultProjectData: ProjectData = {
      tracks: [
        {
          id: nanoid(),
          type: 'overlay',
          name: 'Overlay Track',
          position: 0,
          settings: { opacity: 1, visible: true, locked: false },
          processing_settings: {
            use_webassembly: true,
            quality_preset: 'balanced',
            cache_frames: true
          }
        },
        {
          id: nanoid(),
          type: 'video',
          name: 'Video Track 1',
          position: 1,
          settings: { volume: 1, visible: true, locked: false },
          processing_settings: {
            use_webassembly: true,
            quality_preset: 'balanced',
            cache_frames: true
          }
        },
        {
          id: nanoid(),
          type: 'audio',
          name: 'Audio Track 1',
          position: 2,
          settings: { volume: 1, visible: true, locked: false },
          processing_settings: {
            use_webassembly: true,
            quality_preset: 'performance',
            cache_frames: false
          }
        }
      ],
      clips: [],
      transitions: [],
      effects: [],
      timeline: {
        zoom: 1,
        scroll: 0,
        currentTime: 0
      },
      // NEW: Default WebAssembly settings
      webassembly_settings: {
        enabled: true,
        processing_quality: 'medium',
        use_simd: false, // Will be detected in Phase 2
        worker_threads: Math.min(typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4, 4),
        memory_limit_mb: 512,
        cache_strategy: 'balanced'
      },
      performance_data: {
        cache_hit_rate: 0,
        memory_usage: 0
      }
    };

    // Detect device capabilities for optimal settings
    const deviceCapabilities = await storageOrchestrator.detectDeviceCapabilities();
    
    // Adjust default settings based on device
    if (deviceCapabilities.performance_profile.recommended_quality === 'low') {
      defaultProjectData.webassembly_settings!.processing_quality = 'low';
      defaultProjectData.webassembly_settings!.memory_limit_mb = 256;
    } else if (deviceCapabilities.performance_profile.recommended_quality === 'high') {
      defaultProjectData.webassembly_settings!.processing_quality = 'high';
      defaultProjectData.webassembly_settings!.memory_limit_mb = 1024;
    }

    const { data, error } = await supabase
      .from('video_editor_projects')
      .insert({
        user_id: user.id,
        title,
        project_data: defaultProjectData,
        // NEW: Enhanced project metadata
        project_metadata: {
          total_assets: 0,
          processing_status: 'ready',
          webassembly_compatible: deviceCapabilities.capabilities.webassembly_supported,
          cache_status: {
            thumbnails_cached: 0,
            waveforms_cached: 0,
            frames_cached: 0
          },
          collaboration: {
            shared_with: [],
            sync_status: 'synced'
          }
        },
        optimization_data: {
          complexity_score: 1,
          recommended_settings: {
            webassembly_enabled: true,
            quality_preset: deviceCapabilities.performance_profile.recommended_quality,
            worker_count: deviceCapabilities.performance_profile.max_concurrent_jobs
          },
          bottlenecks: []
        }
      })
      .select()
      .single();

    if (error) throw error;
    
    // Cache the new project immediately
    await storageOrchestrator.saveProject(data.id, defaultProjectData);
    
    return data;
  }

  // Get all projects for current user
  static async getUserProjects(): Promise<VideoEditorProject[]> {
    await this.ensureInitialized();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('video_editor_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get a specific project using storage orchestrator
  static async getProject(projectId: string, bypassCache: boolean = false): Promise<VideoEditorProject> {
    await this.ensureInitialized();
    
    // If bypassing cache, go directly to Supabase
    if (bypassCache) {
    const { data, error } = await supabase
      .from('video_editor_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
      if (!data) throw new Error('Project not found');
      
      // Update last opened timestamp
      await this.updateLastOpened(projectId);
      
    return data;
  }

    const project = await storageOrchestrator.loadProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Update last opened timestamp
    await this.updateLastOpened(projectId);
    
    return project;
  }

  // Update project data using storage orchestrator
  static async updateProject(
    projectId: string, 
    updates: Partial<VideoEditorProject>
  ): Promise<VideoEditorProject> {
    await this.ensureInitialized();

    const { data, error } = await supabase
      .from('video_editor_projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update project data using storage orchestrator (for timeline changes)
  static async updateProjectData(
    projectId: string, 
    projectData: ProjectData
  ): Promise<void> {
    await this.ensureInitialized();
    
    // Use storage orchestrator for optimized saving
    const success = await storageOrchestrator.saveProject(projectId, projectData);
    if (!success) {
      throw new Error('Failed to save project data');
    }
  }

  // Auto-save project data using storage orchestrator
  static async autoSaveProject(
    projectId: string, 
    projectData: ProjectData
  ): Promise<void> {
    await this.ensureInitialized();
    
    // Storage orchestrator handles caching and debounced saves
    await storageOrchestrator.saveProject(projectId, projectData);
    
    // Also update auto-save fields in database
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
        auto_save_data: projectData,
        last_auto_save: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) {
      console.warn('Failed to update auto-save timestamp:', error);
      // Don't throw error as the main save was successful
    }
  }

  // Delete project
  static async deleteProject(projectId: string): Promise<void> {
    await this.ensureInitialized();
    
    const { error } = await supabase
      .from('video_editor_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    
    // Clear project from cache
    // Note: We don't have a direct cache removal method yet, but cache will expire
  }

  // Update last opened timestamp
  static async updateLastOpened(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
        last_opened_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) {
      console.warn('Failed to update last opened timestamp:', error);
      // Don't throw error as this is not critical
    }
  }

  // Get user's video assets using storage orchestrator
  static async getUserVideoAssets(): Promise<UserAsset[]> {
    await this.ensureInitialized();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_assets')
      .select('*')
      .eq('user_id', user.id)
      .or('content_type.like.video%,content_type.like.audio%')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get a specific asset using storage orchestrator
  static async getAsset(assetId: string): Promise<UserAsset> {
    await this.ensureInitialized();
    
    const asset = await storageOrchestrator.loadAsset(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }
    
    return asset;
  }

  // NEW: Get asset URL with caching optimization
  static getAssetUrl(asset: UserAsset): string {
    return storageOrchestrator.getAssetUrl(asset);
  }

  // NEW: Get thumbnail for video asset
  static async getThumbnail(assetId: string, timestamp: number = 0): Promise<Blob | null> {
    await this.ensureInitialized();
    return storageOrchestrator.getThumbnail(assetId, timestamp);
  }

  // NEW: Get audio waveform for asset
  static async getWaveform(assetId: string): Promise<Float32Array | null> {
    await this.ensureInitialized();
    return storageOrchestrator.getWaveform(assetId);
  }

  // NEW: Export project (tracks export without storing in R2)
  static async exportProject(
    projectId: string,
    exportSettings: any
  ): Promise<string> {
    await this.ensureInitialized();
    
    const exportId = await storageOrchestrator.trackExport(
      projectId,
      exportSettings,
      true // WebAssembly will be used in future phases
    );
    
    return exportId;
  }

  // NEW: Update export progress
  static async updateExportProgress(
    exportId: string,
    progress: number,
    status?: string
  ): Promise<void> {
    await this.ensureInitialized();
    
    await storageOrchestrator.updateExportProgress(exportId, progress, status);
  }

  // NEW: Get performance metrics
  static async getPerformanceMetrics(): Promise<any> {
    await this.ensureInitialized();
    
    return {
      storage: await storageOrchestrator.getPerformanceMetrics(),
      cache: await storageOrchestrator.getCacheStatus()
    };
  }

  // NEW: Optimize cache for better performance
  static async optimizeCache(): Promise<void> {
    await this.ensureInitialized();
    await storageOrchestrator.optimizeCache();
  }

  // NEW: Clear cache if needed
  static async clearCache(): Promise<void> {
    await this.ensureInitialized();
    await storageOrchestrator.clearCache();
  }

  // NEW: Detect and save device capabilities
  static async detectDeviceCapabilities(): Promise<any> {
    await this.ensureInitialized();
    
    const capabilities = await storageOrchestrator.detectDeviceCapabilities();
    
    // Optionally save to database for analytics
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const deviceId = `${user.id}_${navigator.userAgent.slice(0, 50)}`;
      
      try {
        await supabase
          .from('device_capabilities')
          .upsert({
            user_id: user.id,
            device_id: deviceId,
            ...capabilities,
            last_updated: new Date().toISOString()
          });
      } catch (error) {
        console.warn('Failed to save device capabilities:', error);
        // Don't throw error as this is not critical
      }
    }
    
    return capabilities;
  }
}

// Helper functions for common operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

// Create debounced auto-save function using storage orchestrator
export const createAutoSave = (projectId: string) => 
  debounce((projectData: ProjectData) => {
    VideoProjectService.autoSaveProject(projectId, projectData);
  }, 2000); // Auto-save every 2 seconds 