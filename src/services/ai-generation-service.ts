import { createClient } from '@/lib/supabase/client';
import {
  AIGeneration,
  AIGenerationInsert,
  AIGenerationUpdate,
  UserAsset,
  UserAssetInsert
} from '@/types/database';
import { MediaAssetService } from './media-assets';
import { deviceFingerprint } from '@/lib/device/device-fingerprint';

const supabase = createClient();

export class AIGenerationService {
  // ============================================================================
  // AI GENERATION MANAGEMENT
  // ============================================================================

  /**
   * Start a new AI generation request
   */
  static async startGeneration(
    generationType: 'text_to_video' | 'image_to_video' | 'audio_generation' | 'text_generation',
    prompt: string,
    options: {
      projectId?: string;
      aiModel: string;
      negativePrompt?: string;
      parameters?: any;
    }
  ): Promise<AIGeneration | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const generationData: AIGenerationInsert = {
        user_id: user.id,
        project_id: options.projectId,
        generation_type: generationType,
        ai_model: options.aiModel,
        prompt,
        negative_prompt: options.negativePrompt,
        parameters: options.parameters || {},
        status: 'pending',
        progress: 0,
        generation_metadata: {
          started_at: new Date().toISOString(),
          device_fingerprint: await deviceFingerprint.getFingerprint(),
          model_version: options.aiModel,
          estimated_duration: this.estimateGenerationTime(generationType, options.parameters)
        }
      };

      const { data, error } = await supabase
        .from('ai_generations')
        .insert(generationData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error starting AI generation:', error);
      return null;
    }
  }

  /**
   * Update generation progress
   */
  static async updateGenerationProgress(
    generationId: string,
    progress: number,
    status?: 'pending' | 'processing' | 'completed' | 'failed'
  ): Promise<AIGeneration | null> {
    try {
      const updateData: AIGenerationUpdate = {
        progress: Math.max(0, Math.min(100, progress)),
        ...(status && { status })
      };

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('ai_generations')
        .update(updateData)
        .eq('id', generationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating generation progress:', error);
      return null;
    }
  }

  /**
   * Complete generation and create asset
   */
  static async completeGeneration(
    generationId: string,
    generatedFile: File,
    metadata: any = {}
  ): Promise<{ generation: AIGeneration; asset: UserAsset } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get generation record
      const { data: generation, error: genError } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('id', generationId)
        .single();

      if (genError || !generation) throw genError;

      // Create asset for generated content
      const assetResult = await MediaAssetService.uploadMediaAsset(generatedFile, {
        onProgress: (progress: number) => {
          console.log(`Asset upload progress: ${progress}%`);
        }
      });

      if (!assetResult.success || !assetResult.asset) {
        throw new Error('Failed to create asset for generated content');
      }

      // Update asset to mark as AI-generated
      const { data: updatedAsset, error: updateError } = await supabase
        .from('user_assets')
        .update({
          ai_generated: true,
          ai_prompt: generation.prompt,
          ai_model: generation.ai_model,
          ai_generation_data: {
            generation_id: generationId,
            generation_type: generation.generation_type,
            parameters: generation.parameters,
            metadata
          }
        })
        .eq('id', assetResult.asset.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Complete generation
      const { data: completedGeneration, error: completeError } = await supabase
        .from('ai_generations')
        .update({
          status: 'completed',
          progress: 100,
          generated_asset_id: assetResult.asset.id,
          completed_at: new Date().toISOString(),
          generation_metadata: {
            ...generation.generation_metadata,
            completed_at: new Date().toISOString(),
            asset_id: assetResult.asset.id,
            file_size: generatedFile.size,
            ...metadata
          }
        })
        .eq('id', generationId)
        .select()
        .single();

      if (completeError) throw completeError;

      return {
        generation: completedGeneration,
        asset: updatedAsset
      };
    } catch (error) {
      console.error('Error completing generation:', error);
      
      // Mark generation as failed
      await this.updateGenerationProgress(generationId, 0, 'failed');
      return null;
    }
  }

  /**
   * Mark generation as failed
   */
  static async failGeneration(generationId: string, errorMessage: string): Promise<void> {
    try {
      await supabase
        .from('ai_generations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          generation_metadata: {
            error: errorMessage,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', generationId);
    } catch (error) {
      console.error('Error marking generation as failed:', error);
    }
  }

  /**
   * Get user's AI generations
   */
  static async getUserGenerations(
    limit: number = 50,
    offset: number = 0
  ): Promise<AIGeneration[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user generations:', error);
      return [];
    }
  }

  /**
   * Get AI generations for a specific project
   */
  static async getProjectGenerations(projectId: string): Promise<AIGeneration[]> {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting project generations:', error);
      return [];
    }
  }

  /**
   * Get generation status with details
   */
  static async getGenerationStatus(generationId: string): Promise<AIGeneration | null> {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('id', generationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting generation status:', error);
      return null;
    }
  }

  /**
   * Cancel a pending generation
   */
  static async cancelGeneration(generationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_generations')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          generation_metadata: {
            cancelled_at: new Date().toISOString(),
            cancelled_by_user: true
          }
        })
        .eq('id', generationId)
        .in('status', ['pending', 'processing']);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error cancelling generation:', error);
      return false;
    }
  }

  /**
   * Delete generation record
   */
  static async deleteGeneration(generationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ai_generations')
        .delete()
        .eq('id', generationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting generation:', error);
      return false;
    }
  }

  /**
   * Get AI generation statistics
   */
  static async getGenerationStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    byType: Record<string, number>;
    byModel: Record<string, number>;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_generations')
        .select('status, generation_type, ai_model')
        .eq('user_id', user.id);

      if (error) throw error;

      const stats = {
        total: data.length,
        completed: 0,
        failed: 0,
        pending: 0,
        byType: {} as Record<string, number>,
        byModel: {} as Record<string, number>
      };

      data.forEach(gen => {
        // Count by status
        if (gen.status === 'completed') stats.completed++;
        else if (gen.status === 'failed') stats.failed++;
        else stats.pending++;

        // Count by type
        stats.byType[gen.generation_type] = (stats.byType[gen.generation_type] || 0) + 1;

        // Count by model
        stats.byModel[gen.ai_model] = (stats.byModel[gen.ai_model] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting generation stats:', error);
      return {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        byType: {},
        byModel: {}
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Estimate generation time based on type and parameters
   */
  private static estimateGenerationTime(
    type: string,
    parameters: any = {}
  ): number {
    const baseTime = {
      'text_to_video': 180, // 3 minutes
      'image_to_video': 120, // 2 minutes
      'audio_generation': 60,  // 1 minute
      'text_generation': 30    // 30 seconds
    };

    let time = baseTime[type as keyof typeof baseTime] || 60;

    // Adjust based on parameters
    if (parameters.duration) {
      time += parameters.duration * 10; // Add 10 seconds per second of content
    }

    if (parameters.quality === 'high') {
      time *= 1.5;
    }

    return Math.round(time);
  }

  /**
   * Get available AI models for generation type
   */
  static getAvailableModels(generationType: string): string[] {
    const models = {
      'text_to_video': [
        'runway-gen3',
        'stable-video-diffusion',
        'pika-labs',
        'zeroscope-v2'
      ],
      'image_to_video': [
        'runway-gen3',
        'stable-video-diffusion',
        'pika-labs'
      ],
      'audio_generation': [
        'musicgen-large',
        'audiogen',
        'bark'
      ],
      'text_generation': [
        'gpt-4',
        'claude-3',
        'gemini-pro'
      ]
    };

    return models[generationType as keyof typeof models] || [];
  }

  /**
   * Get model capabilities
   */
  static getModelCapabilities(model: string): {
    maxDuration: number;
    supportedFormats: string[];
    maxResolution: { width: number; height: number };
    features: string[];
  } {
    const capabilities = {
      'runway-gen3': {
        maxDuration: 10,
        supportedFormats: ['mp4', 'gif'],
        maxResolution: { width: 1920, height: 1080 },
        features: ['motion_control', 'style_transfer', 'object_removal']
      },
      'stable-video-diffusion': {
        maxDuration: 5,
        supportedFormats: ['mp4'],
        maxResolution: { width: 1024, height: 576 },
        features: ['image_conditioning', 'camera_motion']
      },
      'pika-labs': {
        maxDuration: 3,
        supportedFormats: ['mp4', 'gif'],
        maxResolution: { width: 1280, height: 720 },
        features: ['text_prompts', 'image_prompts']
      }
    };

    return capabilities[model as keyof typeof capabilities] || {
      maxDuration: 5,
      supportedFormats: ['mp4'],
      maxResolution: { width: 1280, height: 720 },
      features: []
    };
  }

  /**
   * Validate generation parameters
   */
  static validateGenerationParams(
    generationType: string,
    model: string,
    parameters: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const capabilities = this.getModelCapabilities(model);

    // Check duration
    if (parameters.duration && parameters.duration > capabilities.maxDuration) {
      errors.push(`Duration exceeds maximum of ${capabilities.maxDuration} seconds for ${model}`);
    }

    // Check resolution
    if (parameters.resolution) {
      const { width, height } = parameters.resolution;
      if (width > capabilities.maxResolution.width || height > capabilities.maxResolution.height) {
        errors.push(`Resolution exceeds maximum of ${capabilities.maxResolution.width}x${capabilities.maxResolution.height} for ${model}`);
      }
    }

    // Check format
    if (parameters.format && !capabilities.supportedFormats.includes(parameters.format)) {
      errors.push(`Format ${parameters.format} not supported by ${model}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 