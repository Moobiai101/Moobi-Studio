import { createClient } from "@/lib/supabase/client";
import { UserAsset } from "@/types/database";
import { detectFileType, getVideoMetadata, getMediaDuration, getImageDimensions } from "@/components/video-studio/lib/media-utils";

const supabase = createClient();

// Use your existing worker URL (same as other studios)
const WORKER_API_URL = 'https://my-ai-worker.khansameersam96.workers.dev';

interface MediaUploadOptions {
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
}

interface UploadResult {
  asset: UserAsset;
  success: boolean;
  error?: string;
}

export class MediaAssetService {
  /**
   * Production-grade media upload pipeline using existing worker infrastructure:
   * 1. Extract metadata from file locally
   * 2. Use existing /api/commit-asset endpoint for upload + database save
   * 3. Return complete UserAsset object
   */
  static async uploadMediaAsset(
    file: File, 
    options: MediaUploadOptions = {}
  ): Promise<UploadResult> {
    const { onProgress, onStatusChange } = options;
    
    try {
      // Get authenticated user session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("User not authenticated");
      }

      onStatusChange?.("Extracting metadata...");
      onProgress?.(20);

      // Extract file metadata based on type
      const metadata = await this.extractFileMetadata(file);
      
      onStatusChange?.("Creating temporary URL...");
      onProgress?.(40);

      // Create temporary blob URL for upload
      const tempUrl = URL.createObjectURL(file);
      
      onStatusChange?.("Uploading to cloud storage...");
      onProgress?.(60);

      // Use existing /api/commit-asset endpoint (same as image studios)
      const payload = {
        imageTemporaryUrl: tempUrl,
        originalPrompt: `Media file: ${file.name}`,
        contentType: file.type,
        sourceStudio: 'video-studio',
        userDefinedTitle: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
        userDefinedDescription: `Uploaded media file for video editing`,
        userDefinedTags: [],
        generationMetadata: {
          uploadType: 'direct_upload',
          originalFileName: file.name,
          fileSize: file.size,
          duration: metadata.duration,
          dimensions: metadata.dimensions,
          videoMetadata: metadata.videoMetadata
        }
      };

      const response = await fetch(`${WORKER_API_URL}/api/commit-asset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      // Clean up temporary URL
      URL.revokeObjectURL(tempUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.asset) {
        throw new Error("Upload completed but asset data missing");
      }

      onStatusChange?.("Complete!");
      onProgress?.(100);

      // Convert the worker response to UserAsset format
      const userAsset: UserAsset = {
        id: result.asset.id,
        user_id: session.user?.id || '',
        title: result.asset.title || payload.userDefinedTitle,
        description: payload.userDefinedDescription,
        tags: payload.userDefinedTags,
        r2_object_key: result.asset.r2_object_key || '',
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
        source_studio: 'video-studio',
        duration_seconds: metadata.duration,
        dimensions: metadata.dimensions,
        video_metadata: metadata.videoMetadata,
        created_at: result.asset.createdAt || new Date().toISOString(),
        updated_at: result.asset.createdAt || new Date().toISOString()
      };

      return {
        asset: userAsset,
        success: true
      };

    } catch (error) {
      console.error("Media upload failed:", error);
      return {
        asset: {} as UserAsset,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Extract comprehensive metadata from uploaded file
   */
  private static async extractFileMetadata(file: File) {
    const fileType = detectFileType(file);
    const tempUrl = URL.createObjectURL(file);
    
    try {
      switch (fileType) {
        case 'video': {
          const videoMeta = await getVideoMetadata(tempUrl);
          return {
            duration: videoMeta.duration,
            dimensions: {
              width: videoMeta.width,
              height: videoMeta.height,
            },
            videoMetadata: {
              fps: videoMeta.fps,
              codec: 'unknown',
              bitrate: 'unknown'
            }
          };
        }
        
        case 'audio': {
          const duration = await getMediaDuration(tempUrl, 'audio');
          return { 
            duration,
            dimensions: undefined,
            videoMetadata: undefined
          };
        }
        
        case 'image': {
          const dimensions = await getImageDimensions(tempUrl);
          return {
            duration: 5, // Default duration for images in timeline
            dimensions,
            videoMetadata: undefined
          };
        }
        
        default:
          return {
            duration: undefined,
            dimensions: undefined,
            videoMetadata: undefined
          };
      }
    } catch (error) {
      console.warn(`Metadata extraction failed for ${file.name}:`, error);
      // Return sensible defaults
      return {
        duration: fileType === 'image' ? 5 : undefined,
        dimensions: undefined,
        videoMetadata: undefined
      };
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  /**
   * Get user's media assets for the video studio using existing worker endpoint
   */
  static async getUserAssets(): Promise<UserAsset[]> {
    try {
      // Get authenticated user session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        console.error("User not authenticated for asset fetch");
        return [];
      }

      // Use existing /api/assets endpoint
      const response = await fetch(`${WORKER_API_URL}/api/assets`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.status}`);
      }

      const assets = await response.json();
      
      // Filter for video studio assets and convert to UserAsset format
      return assets
        .filter((asset: any) => asset.source_studio === 'video-studio')
        .map((asset: any): UserAsset => ({
          id: asset.id,
          user_id: asset.user_id,
          title: asset.title || asset.file_name,
          description: asset.description || '',
          tags: asset.tags || [],
          r2_object_key: asset.r2_object_key,
          file_name: asset.file_name,
          content_type: asset.content_type,
          file_size_bytes: asset.file_size_bytes,
          source_studio: asset.source_studio,
          duration_seconds: asset.duration_seconds,
          dimensions: asset.dimensions,
          video_metadata: asset.video_metadata,
          created_at: asset.created_at,
          updated_at: asset.updated_at
        }));

    } catch (error) {
      console.error("Failed to fetch user assets:", error);
      return [];
    }
  }

  /**
   * Delete media asset using existing worker endpoint
   */
  static async deleteAsset(assetId: string): Promise<boolean> {
    try {
      // Get authenticated user session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("User not authenticated");
      }

      // Use existing /api/assets/:id DELETE endpoint
      const response = await fetch(`${WORKER_API_URL}/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Delete failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error("Asset deletion failed:", error);
      return false;
    }
  }

  /**
   * Generate display URL for asset access using worker media proxy
   */
  static getAssetUrl(r2Key: string): string {
    // Use existing worker media proxy endpoint
    return `${WORKER_API_URL}/api/media?key=${encodeURIComponent(r2Key)}`;
  }
} 