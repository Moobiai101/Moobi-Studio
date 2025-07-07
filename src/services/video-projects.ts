import { createClient } from '@/lib/supabase/client';
import { 
  VideoEditorProject, 
  VideoEditorProjectInsert, 
  VideoEditorProjectUpdate,
  UserAsset,
  ProjectTimelineData 
} from '@/types/database';
import { TimelineService } from './timeline-service';
import { deviceFingerprint } from '@/lib/device/device-fingerprint';

const supabase = createClient();

export class VideoProjectService {
  // Create a new video project with local-first approach
  static async createProject(title: string = 'Untitled Project'): Promise<VideoEditorProject> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Get device fingerprint for tracking
      const fingerprint = await deviceFingerprint.getFingerprint();

      // Create project with new local-first schema
      const projectData: VideoEditorProjectInsert = {
        user_id: user.id,
        title,
        description: '',
        duration_seconds: 0,
        fps: 30,
        resolution: { width: 1920, height: 1080 },
        export_settings: {
          format: 'mp4',
          quality: 'high',
          resolution: { width: 1920, height: 1080 },
          fps: 30
        },
        project_data: {
          version: 2,
          local_first: true,
          asset_references: [],
          timeline_settings: {
            zoom: 1,
            scroll: 0,
            currentTime: 0,
            snapToGrid: true,
            gridSize: 1
          }
        },
        timeline_data: {
          currentTime: 0,
        zoom: 1,
        scroll: 0,
          snapToGrid: true
        },
        last_edited_device: fingerprint,
        tags: [],
        is_template: false
    };

      const { data: project, error } = await supabase
      .from('video_editor_projects')
        .insert(projectData)
      .select()
      .single();

    if (error) throw error;

      // Create default tracks for the project
      await TimelineService.createDefaultTracks(project.id);

      // Create initial recovery point
      await TimelineService.saveRecoveryPoint(
        project.id,
        projectData,
        []
      );

      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Get all projects for current user
  static async getUserProjects(): Promise<VideoEditorProject[]> {
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

  // Get a specific project with full timeline data
  static async getProject(projectId: string): Promise<VideoEditorProject> {
    const { data, error } = await supabase
      .from('video_editor_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data;
  }

  // Get project with complete timeline data
  static async getProjectWithTimeline(projectId: string): Promise<{
    project: VideoEditorProject;
    timeline: ProjectTimelineData;
  }> {
    try {
      const [project, timeline] = await Promise.all([
        this.getProject(projectId),
        TimelineService.getCompleteTimeline(projectId)
      ]);

      return {
        project,
        timeline
      };
    } catch (error) {
      console.error('Error getting project with timeline:', error);
      throw error;
    }
  }

  // Update project metadata
  static async updateProject(
    projectId: string, 
    updates: VideoEditorProjectUpdate
  ): Promise<VideoEditorProject> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();
      
    const { data, error } = await supabase
      .from('video_editor_projects')
      .update({
        ...updates,
          last_edited_device: fingerprint,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  // Update project timeline data
  static async updateProjectTimeline(
    projectId: string, 
    timelineData: any
  ): Promise<void> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();
      
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
          timeline_data: timelineData,
          last_edited_device: fingerprint,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;
    } catch (error) {
      console.error('Error updating project timeline:', error);
      throw error;
    }
  }

  // Auto-save project state
  static async autoSaveProject(
    projectId: string, 
    projectState: any,
    assetManifest: any[] = []
  ): Promise<void> {
    try {
      // Save recovery point instead of auto-save data
      await TimelineService.saveRecoveryPoint(
        projectId,
        projectState,
        assetManifest
      );

      // Update project timestamp
      const fingerprint = await deviceFingerprint.getFingerprint();
      await supabase
      .from('video_editor_projects')
      .update({
          last_edited_device: fingerprint,
          updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    } catch (error) {
      console.error('Error auto-saving project:', error);
      throw error;
    }
  }

  // Delete project and all related data
  static async deleteProject(projectId: string): Promise<void> {
    try {
    const { error } = await supabase
      .from('video_editor_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  // Update last opened timestamp
  static async updateLastOpened(projectId: string): Promise<void> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();
      
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
          last_edited_device: fingerprint,
          updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;
    } catch (error) {
      console.error('Error updating last opened:', error);
      throw error;
    }
  }

  // Get user's video assets (local-first compatible)
  static async getUserVideoAssets(): Promise<UserAsset[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
    const { data, error } = await supabase
      .from('user_assets')
      .select('*')
      .eq('user_id', user.id)
        .eq('source_studio', 'video-studio')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
    } catch (error) {
      console.error('Error getting user video assets:', error);
      return [];
    }
  }

  // Get a specific asset
  static async getAsset(assetId: string): Promise<UserAsset> {
    const { data, error } = await supabase
      .from('user_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (error) throw error;
    return data;
  }

  // Get project recovery points
  static async getRecoveryPoints(projectId: string) {
    try {
      const { data, error } = await supabase
        .from('project_recovery_points')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting recovery points:', error);
      return [];
    }
  }

  // Recover project from recovery point
  static async recoverProject(recoveryPointId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('project_recovery_points')
        .select('*')
        .eq('id', recoveryPointId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recovering project:', error);
      throw error;
    }
  }

  // Calculate project duration from timeline
  static async calculateProjectDuration(projectId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_project_duration', { p_project_id: projectId });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error calculating project duration:', error);
      return 0;
    }
  }

  // Duplicate project
  static async duplicateProject(projectId: string, newTitle?: string): Promise<VideoEditorProject> {
    try {
      const originalProject = await this.getProject(projectId);
      const timeline = await TimelineService.getCompleteTimeline(projectId);

      // Create new project
      const newProject = await this.createProject(
        newTitle || `Copy of ${originalProject.title}`
      );

      // Copy timeline data
      // Note: This is a simplified copy - in a full implementation,
      // you'd need to handle asset references and other complex data
      
      return newProject;
    } catch (error) {
      console.error('Error duplicating project:', error);
      throw error;
    }
  }

  // Export project metadata
  static async exportProjectMetadata(projectId: string): Promise<any> {
    try {
      const { project, timeline } = await this.getProjectWithTimeline(projectId);
      
      return {
        project,
        timeline,
        exported_at: new Date().toISOString(),
        version: 2
      };
    } catch (error) {
      console.error('Error exporting project metadata:', error);
      throw error;
    }
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

// Create debounced auto-save function for local-first approach
export const createAutoSave = (projectId: string) => 
  debounce((projectState: any, assetManifest: any[] = []) => {
    VideoProjectService.autoSaveProject(projectId, projectState, assetManifest);
  }, 2000); // Auto-save every 2 seconds 

// Create debounced timeline save function
export const createTimelineSave = (projectId: string) =>
  debounce((timelineData: any) => {
    VideoProjectService.updateProjectTimeline(projectId, timelineData);
  }, 1000); // Save timeline changes every 1 second 