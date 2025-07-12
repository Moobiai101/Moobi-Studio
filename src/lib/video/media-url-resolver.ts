import { MediaAssetService } from '@/services/media-assets';
import { indexedDBManager } from '@/lib/storage/indexed-db-manager';
import React from 'react'; // Added missing import for React

// URL cache to avoid recreating blob URLs
const urlCache = new Map<string, string>();
const errorCache = new Map<string, boolean>();

/**
 * Professional media URL resolver for local-first storage
 * Handles conversion from IndexedDB URLs to blob URLs with graceful error handling
 */
export class MediaUrlResolver {
  /**
   * Resolve any media URL to a usable URL
   * Handles both IndexedDB URLs and regular URLs with comprehensive error handling
   */
  static async resolveUrl(url: string): Promise<string> {
    // Handle IndexedDB URLs
    if (url.startsWith('indexeddb://')) {
      const localAssetId = url.replace('indexeddb://', '');
      
      // Check error cache first - don't retry known failed assets too frequently
      if (errorCache.has(localAssetId)) {
        console.warn(`⚠️ Skipping known corrupted asset: ${localAssetId}`);
        return this.getPlaceholderUrl('corrupted');
      }
      
      // Check cache
      if (urlCache.has(localAssetId)) {
        return urlCache.get(localAssetId)!;
      }
      
      try {
        // First validate asset integrity
        const validation = await indexedDBManager.validateAssetIntegrity(localAssetId);
        if (!validation.valid) {
          console.error(`🚫 Asset integrity validation failed for ${localAssetId}:`, validation.error);
          
          // Cache this error for 5 minutes to avoid repeated validation attempts
          errorCache.set(localAssetId, true);
          setTimeout(() => errorCache.delete(localAssetId), 5 * 60 * 1000);
          
          return this.getPlaceholderUrl('corrupted');
        }
        
        // Get URL from IndexedDB
        const blobUrl = await MediaAssetService.getLocalAssetUrl(localAssetId);
        
        // Cache the URL
        urlCache.set(localAssetId, blobUrl);
        
        // Set up cleanup after some time
        setTimeout(() => {
          const cachedUrl = urlCache.get(localAssetId);
          if (cachedUrl) {
            URL.revokeObjectURL(cachedUrl);
            urlCache.delete(localAssetId);
          }
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log(`✅ Successfully resolved asset: ${localAssetId}`);
        return blobUrl;
      } catch (error) {
        console.error('Failed to resolve IndexedDB URL:', error);
        
        // Determine error type for better fallback
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('corrupted') || errorMessage.includes('missing')) {
          // Cache corruption errors
          errorCache.set(localAssetId, true);
          setTimeout(() => errorCache.delete(localAssetId), 5 * 60 * 1000);
          return this.getPlaceholderUrl('corrupted');
        } else if (errorMessage.includes('not found')) {
          return this.getPlaceholderUrl('missing');
        } else {
          return this.getPlaceholderUrl('error');
        }
      }
    }
    
    // Regular URLs pass through
    return url;
  }
  
  /**
   * Get appropriate placeholder URL based on error type
   */
  private static getPlaceholderUrl(errorType: 'missing' | 'corrupted' | 'error'): string {
    // Create colored placeholder SVG based on error type
    const placeholders = {
      missing: this.createPlaceholderSvg('Asset Missing', '#FF6B6B', 'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z'),
      corrupted: this.createPlaceholderSvg('Asset Corrupted', '#FFA726', 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'),
      error: this.createPlaceholderSvg('Loading Error', '#9E9E9E', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z')
    };
    
    return placeholders[errorType];
  }
  
  /**
   * Create a placeholder SVG data URL
   */
  private static createPlaceholderSvg(text: string, color: string, iconPath: string): string {
    const svg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5" stroke="#ddd" stroke-width="2" stroke-dasharray="5,5"/>
        <g transform="translate(200, 120)">
          <circle cx="0" cy="0" r="30" fill="${color}" opacity="0.8"/>
          <path d="${iconPath}" transform="translate(-12, -12)" fill="white"/>
        </g>
        <text x="200" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#666">${text}</text>
        <text x="200" y="220" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#999">Try re-uploading this file</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
  
  /**
   * Clear all cached URLs and errors
   */
  static clearCache(): void {
    // Revoke all cached blob URLs
    for (const [key, url] of urlCache) {
      URL.revokeObjectURL(url);
    }
    
    urlCache.clear();
    errorCache.clear();
    console.log('🧹 Cleared media URL cache');
  }
  
  /**
   * Get cache statistics
   */
  static getCacheStats(): { cachedUrls: number; erroredAssets: number } {
    return {
      cachedUrls: urlCache.size,
      erroredAssets: errorCache.size
    };
  }
}

/**
 * React hook for resolving media URLs with loading states
 */
export function useResolvedMediaUrl(url: string | null) {
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!url) {
      setResolvedUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    MediaUrlResolver.resolveUrl(url)
      .then((resolved) => {
        setResolvedUrl(resolved);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to resolve media URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load media');
        setResolvedUrl(MediaUrlResolver['getPlaceholderUrl']('error'));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [url]);

  return { url: resolvedUrl, isLoading, error };
} 