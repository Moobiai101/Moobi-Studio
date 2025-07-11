import { createClient } from "@/lib/supabase/client";
import { UserAsset } from "@/types/database";
import { indexedDBManager } from '@/lib/storage/indexed-db-manager';
import { 
  getMediaDuration, 
  getVideoMetadata, 
  getImageDimensions,
  createVideoThumbnail 
} from '@/components/video-studio/lib/media-utils';

const supabase = createClient();

// Use your existing worker URL (same as other studios)
const WORKER_API_URL = 'https://my-ai-worker.khansameersam96.workers.dev';

interface MediaUploadOptions {
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
}

interface UploadResult {
  asset?: UserAsset;
  success: boolean;
  error?: string;
}

export class MediaAssetService {
  private static supabase = createClient();

  /**
   * Upload media asset using local-first approach
   * Files are stored in IndexedDB, metadata synced to cloud
   */
  static async uploadMediaAsset(
    file: File, 
    options: MediaUploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Get authenticated user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) {
        return { success: false, error: 'User not authenticated' };
      }

      // No device registration needed in simplified approach

      // Update status
      options.onStatusChange?.('Storing file locally...');
      options.onProgress?.(10);

      // Store file in IndexedDB
      const localAssetId = await indexedDBManager.storeMediaAsset(file);
      options.onProgress?.(30);

      // Extract metadata based on file type
      options.onStatusChange?.('Extracting metadata...');
      let duration: number | undefined;
      let dimensions: { width: number; height: number } | undefined;
      let videoMetadata: any = undefined;

      const fileType = file.type.startsWith('video/') ? 'video' : 
                       file.type.startsWith('audio/') ? 'audio' : 
                       file.type.startsWith('image/') ? 'image' : 'unknown';

      if (fileType === 'video') {
        const blobUrl = await indexedDBManager.getMediaAssetUrl(localAssetId);
        const metadata = await getVideoMetadata(blobUrl);
        duration = metadata.duration;
        dimensions = { width: metadata.width, height: metadata.height };
        videoMetadata = { fps: metadata.fps || 30 };
        
        // Generate thumbnail
        options.onStatusChange?.('Generating thumbnail...');
        try {
          const thumbnailDataUrl = await createVideoThumbnail(blobUrl, 2);
          const thumbnailBlob = await this.dataUrlToBlob(thumbnailDataUrl);
          await indexedDBManager.storeThumbnail(localAssetId.replace('local_', ''), thumbnailBlob);
        } catch (error) {
          console.warn('Failed to generate thumbnail:', error);
        }
        
        URL.revokeObjectURL(blobUrl);
      } else if (fileType === 'audio') {
        const blobUrl = await indexedDBManager.getMediaAssetUrl(localAssetId);
        duration = await getMediaDuration(blobUrl, 'audio');
        URL.revokeObjectURL(blobUrl);
      } else if (fileType === 'image') {
        const blobUrl = await indexedDBManager.getMediaAssetUrl(localAssetId);
        dimensions = await getImageDimensions(blobUrl);
        duration = 5; // Default duration for images
        URL.revokeObjectURL(blobUrl);
      }

      options.onProgress?.(60);

      // Create asset record in database (metadata only)
      options.onStatusChange?.('Syncing metadata...');
      const { data: asset, error: assetError } = await this.supabase
        .from('user_assets')
        .insert({
          user_id: user.id,
          title: file.name,
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
        source_studio: 'video-studio',
          local_asset_id: localAssetId,
          r2_object_key: localAssetId, // Use local ID as key
          duration_seconds: duration,
          dimensions,
          video_metadata: videoMetadata,
          thumbnails_generated: fileType === 'video',
          tags: [],
          is_local_available: true, // Set local availability
          local_storage_key: localAssetId
        })
        .select()
        .single();

      if (assetError) {
        throw assetError;
      }

      options.onProgress?.(100);
      options.onStatusChange?.('Upload complete!');

      return { success: true, asset };

    } catch (error) {
      console.error('Error uploading media asset:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Get all user assets (simplified user-only approach)
   */
  static async getUserAssets(): Promise<UserAsset[]> {
    try {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) {
        console.error('User not authenticated');
        return [];
      }

      // Get all user assets (simple query)
      const { data: assets, error } = await this.supabase
        .from('user_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user assets:', error);
        return [];
      }

      if (!assets) {
        return [];
      }

      // Add local availability info (simplified)
      const assetsWithAvailability = assets.map((asset) => ({
            ...asset,
        _localAvailable: asset.is_local_available || !!asset.local_asset_id,
        _localPath: asset.local_storage_key || asset.local_asset_id
      }));

      return assetsWithAvailability;
    } catch (error) {
      console.error('Error in getUserAssets:', error);
      return [];
    }
  }

  /**
   * Get asset URL - prioritize local storage
   */
  static getAssetUrl(r2ObjectKey: string): string {
    // If it's a local asset ID, return it directly
    if (r2ObjectKey.startsWith('local_')) {
      // The actual URL will be generated on-demand from IndexedDB
      // For now, return a special URL that components will recognize
      return `indexeddb://${r2ObjectKey}`;
    }
    
    // For cloud assets, use the worker proxy endpoint
    // Get the worker URL from environment or use the default
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'https://my-ai-worker.khansameersam96.workers.dev';
    return `${workerUrl}/api/media?key=${encodeURIComponent(r2ObjectKey)}`;
  }

  /**
   * Validate and sync local assets with IndexedDB
   * This ensures database references match what's actually stored locally
   */
  static async validateAndSyncLocalAssets(): Promise<{
    valid: number;
    orphaned: number;
    missing: number;
    cleaned: string[];
  }> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        console.warn('User not authenticated for asset validation');
        return { valid: 0, orphaned: 0, missing: 0, cleaned: [] };
      }

      // Get all assets from database
      const { data: assets } = await this.supabase
        .from('user_assets')
        .select('*')
        .eq('user_id', user.id)
        .eq('source_studio', 'video-studio');

      if (!assets) {
        return { valid: 0, orphaned: 0, missing: 0, cleaned: [] };
      }

      const localAssets = assets.filter(asset => asset.local_asset_id);
      let validCount = 0;
      let missingCount = 0;
      const cleanedAssets: string[] = [];

      console.log(`🔍 Validating ${localAssets.length} local assets...`);

      for (const asset of localAssets) {
        if (!asset.local_asset_id) continue;

        try {
          const exists = await indexedDBManager.hasAsset(asset.local_asset_id);
          
          if (exists) {
            validCount++;
          } else {
            missingCount++;
            console.warn(`⚠️ Database references missing asset: ${asset.file_name} (${asset.local_asset_id})`);
            
            // Optionally clean up orphaned database entries
            // Uncomment the following lines to enable automatic cleanup:
            /*
            await this.supabase
              .from('user_assets')
              .delete()
              .eq('id', asset.id);
            cleanedAssets.push(asset.file_name);
            */
          }
        } catch (error) {
          console.error(`❌ Error validating asset ${asset.id}:`, error);
          missingCount++;
        }
      }

      console.log(`✅ Asset validation complete: ${validCount} valid, ${missingCount} missing`);
      
      return {
        valid: validCount,
        orphaned: 0, // Could be implemented to check for IndexedDB assets without database references
        missing: missingCount,
        cleaned: cleanedAssets
      };
    } catch (error) {
      console.error('❌ Asset validation failed:', error);
      return { valid: 0, orphaned: 0, missing: 0, cleaned: [] };
    }
  }

  /**
   * Delete media asset (local and cloud)
   */
  static async deleteMediaAsset(assetId: string): Promise<boolean> {
    try {
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) {
        console.error('User not authenticated');
        return false;
      }

      // Get asset details
      const { data: asset } = await this.supabase
        .from('user_assets')
        .select('local_asset_id')
        .eq('id', assetId)
        .single();

      if (asset?.local_asset_id) {
        // Delete from IndexedDB
        await indexedDBManager.deleteAsset(asset.local_asset_id);
      }

      // Delete from database (cascade will handle related records)
      const { error } = await this.supabase
        .from('user_assets')
        .delete()
        .eq('id', assetId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting media asset:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteMediaAsset:', error);
      return false;
    }
  }

  /**
   * Get asset from IndexedDB
   */
  static async getLocalAssetUrl(localAssetId: string): Promise<string> {
    try {
      return await indexedDBManager.getMediaAssetUrl(localAssetId);
    } catch (error) {
      console.error('Error getting local asset:', error);
      throw error;
    }
  }

  /**
   * Check storage status
   */
  static async getStorageInfo() {
    return await indexedDBManager.getStorageInfo();
  }

  /**
   * Convert data URL to Blob
   */
  private static async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return await response.blob();
  }

  /**
   * Request asset recovery (simplified)
   */
  static async requestAssetRecovery(assetId: string): Promise<{
    needsUpload: boolean;
    assetInfo?: any;
  }> {
    try {
      // Get asset metadata
      const { data: asset } = await this.supabase
        .from('user_assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (!asset) {
        return { needsUpload: false };
      }

      // Check if available locally (simplified)
      const isLocallyAvailable = asset.is_local_available && asset.local_storage_key;

      return {
        needsUpload: !isLocallyAvailable,
        assetInfo: {
          filename: asset.file_name,
          contentType: asset.content_type,
          size: asset.file_size_bytes,
          duration: asset.duration_seconds
        }
      };
    } catch (error) {
      console.error('Error in requestAssetRecovery:', error);
      return { needsUpload: true };
    }
  }
} 