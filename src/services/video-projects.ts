import { createClient } from '@/lib/supabase/client';
import { VideoEditorProject, ProjectData, UserAsset } from '@/types/database';
import { nanoid } from 'nanoid';

const supabase = createClient();

export class VideoProjectService {
  // Create a new video project
  static async createProject(title: string = 'Untitled Project'): Promise<VideoEditorProject> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const defaultProjectData: ProjectData = {
      tracks: [
        {
          id: nanoid(),
          type: 'overlay',
          name: 'Overlay Track',
          position: 0,
          settings: { opacity: 1, visible: true, locked: false }
        },
        {
          id: nanoid(),
          type: 'video',
          name: 'Video Track 1',
          position: 1,
          settings: { volume: 1, visible: true, locked: false }
        },
        {
          id: nanoid(),
          type: 'audio',
          name: 'Audio Track 1',
          position: 2,
          settings: { volume: 1, visible: true, locked: false }
        }
      ],
      clips: [],
      transitions: [],
      effects: [],
      timeline: {
        zoom: 1,
        scroll: 0,
        currentTime: 0
      }
    };

    const { data, error } = await supabase
      .from('video_editor_projects')
      .insert({
        user_id: user.id,
        title,
        project_data: defaultProjectData
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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

  // Get a specific project
  static async getProject(projectId: string): Promise<VideoEditorProject> {
    const { data, error } = await supabase
      .from('video_editor_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data;
  }

  // Update project data
  static async updateProject(
    projectId: string, 
    updates: Partial<VideoEditorProject>
  ): Promise<VideoEditorProject> {
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

  // Update project data (for timeline changes)
  static async updateProjectData(
    projectId: string, 
    projectData: ProjectData
  ): Promise<void> {
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
        project_data: projectData,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;
  }

  // Auto-save project data
  static async autoSaveProject(
    projectId: string, 
    projectData: ProjectData
  ): Promise<void> {
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
        auto_save_data: projectData,
        last_auto_save: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;
  }

  // Delete project
  static async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('video_editor_projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
  }

  // Update last opened timestamp
  static async updateLastOpened(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('video_editor_projects')
      .update({
        last_opened_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (error) throw error;
  }

  // Get user's video assets
  static async getUserVideoAssets(): Promise<UserAsset[]> {
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

// Create debounced auto-save function
export const createAutoSave = (projectId: string) => 
  debounce((projectData: ProjectData) => {
    VideoProjectService.autoSaveProject(projectId, projectData);
  }, 2000); // Auto-save every 2 seconds 