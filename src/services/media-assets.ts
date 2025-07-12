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
    
    // Legacy cloud assets (if any)
    return `/storage/proxy/${r2ObjectKey}`;
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
   * Get a local asset URL with enhanced error handling and recovery
   */
  static async getLocalAssetUrl(localAssetId: string): Promise<string> {
    try {
      // Remove 'local_' prefix if present to get the actual asset ID
      const cleanAssetId = localAssetId.startsWith('local_') ? localAssetId.replace('local_', '') : localAssetId;
      
      // First check if the asset exists and is valid
      const validation = await indexedDBManager.validateAssetIntegrity(cleanAssetId);
      if (!validation.valid) {
        console.error(`🚫 Asset integrity check failed for ${cleanAssetId}:`, validation.error);
        throw new Error(`Asset corrupted: ${validation.error}`);
      }
      
      const blob = await indexedDBManager.getMediaAssetBlob(cleanAssetId);
      const url = URL.createObjectURL(blob);
      
      console.log(`✅ Retrieved local asset URL for: ${cleanAssetId}`);
      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error getting local asset: ${errorMessage}`);
      
      // Enhanced error handling with specific error types
      if (errorMessage.includes('corrupted') || errorMessage.includes('missing')) {
        // Mark asset as unavailable and trigger cleanup
        try {
          await this.markAssetAsUnavailable(localAssetId.replace('local_', ''));
        } catch (markError) {
          console.error('Failed to mark asset as unavailable:', markError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Mark an asset as locally unavailable in the database
   */
  private static async markAssetAsUnavailable(assetId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_assets')
        .update({ 
          is_local_available: false,
          local_storage_key: null,
          local_asset_id: null
        })
        .eq('id', assetId);
      
      if (error) throw error;
      
      console.log(`📝 Marked asset ${assetId} as locally unavailable`);
    } catch (error) {
      console.error(`❌ Failed to mark asset ${assetId} as unavailable:`, error);
      throw error;
    }
  }

  /**
   * Attempt to recover a corrupted or missing asset
   */
  static async attemptAssetRecovery(assetId: string): Promise<{ success: boolean; message: string; newUrl?: string }> {
    try {
      // Try to find the asset in database
      const { data: asset, error } = await supabase
        .from('user_assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (error || !asset) {
        return { 
          success: false, 
          message: 'Asset not found in database - may need to be re-uploaded' 
        };
      }

      // If asset has R2 key, try to restore from cloud
      if (asset.r2_object_key && !asset.r2_object_key.startsWith('local_')) {
        try {
          const cloudUrl = this.getAssetUrl(asset.r2_object_key);
          
          // Test if cloud URL is accessible
          const response = await fetch(cloudUrl, { method: 'HEAD' });
          if (response.ok) {
            // Update database to reflect cloud availability
            await supabase
              .from('user_assets')
              .update({ 
                is_local_available: false,
                local_storage_key: null,
                local_asset_id: null
              })
              .eq('id', assetId);
            
            return { 
              success: true, 
              message: 'Asset recovered from cloud storage',
              newUrl: cloudUrl
            };
          }
        } catch (cloudError) {
          console.warn('Cloud recovery failed:', cloudError);
        }
      }

      // If all recovery attempts fail
      return { 
        success: false, 
        message: 'Asset recovery failed - file needs to be re-uploaded' 
      };

    } catch (error) {
      console.error('Asset recovery error:', error);
      return { 
        success: false, 
        message: `Recovery error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate and repair asset integrity across the entire library
   */
  static async validateAndRepairAssetLibrary(): Promise<{
    total: number;
    valid: number;
    corrupted: number;
    recovered: number;
    failed: number;
    report: Array<{ assetId: string; fileName: string; status: string; action: string }>;
  }> {
    console.log('🔧 Starting comprehensive asset library validation...');
    
    const report: Array<{ assetId: string; fileName: string; status: string; action: string }> = [];
    let stats = { total: 0, valid: 0, corrupted: 0, recovered: 0, failed: 0 };

    try {
      // Get all user assets
      const { data: assets, error } = await supabase
        .from('user_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!assets) return { ...stats, report };

      stats.total = assets.length;
      console.log(`📊 Found ${stats.total} assets to validate`);

      for (const asset of assets) {
        const fileName = asset.file_name || 'Unnamed';
        
        try {
          // Check local availability first
          if (asset.is_local_available && asset.local_asset_id) {
            const validation = await indexedDBManager.validateAssetIntegrity(asset.local_asset_id);
            
            if (validation.valid) {
              stats.valid++;
              report.push({ 
                assetId: asset.id, 
                fileName, 
                status: 'valid', 
                action: 'none' 
              });
            } else {
              stats.corrupted++;
              console.log(`🚫 Corrupted local asset found: ${fileName}`);
              
              // Attempt recovery
              const recovery = await this.attemptAssetRecovery(asset.id);
              if (recovery.success) {
                stats.recovered++;
                report.push({ 
                  assetId: asset.id, 
                  fileName, 
                  status: 'corrupted', 
                  action: 'recovered' 
                });
              } else {
                stats.failed++;
                report.push({ 
                  assetId: asset.id, 
                  fileName, 
                  status: 'corrupted', 
                  action: 'failed' 
                });
              }
            }
          } else {
            // Non-local or cloud-only assets
            stats.valid++;
            report.push({ 
              assetId: asset.id, 
              fileName, 
              status: 'cloud', 
              action: 'none' 
            });
          }
        } catch (assetError) {
          stats.failed++;
          console.error(`❌ Error validating asset ${fileName}:`, assetError);
          report.push({ 
            assetId: asset.id, 
            fileName, 
            status: 'error', 
            action: 'failed' 
          });
        }
      }

      console.log(`📊 Asset validation complete:
        - Total: ${stats.total}
        - Valid: ${stats.valid}
        - Corrupted: ${stats.corrupted}
        - Recovered: ${stats.recovered}
        - Failed: ${stats.failed}`);

      return { ...stats, report };

    } catch (error) {
      console.error('❌ Asset library validation failed:', error);
      return { ...stats, report };
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