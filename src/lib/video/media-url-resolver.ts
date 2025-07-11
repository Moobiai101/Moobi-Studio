import { MediaAssetService } from '@/services/media-assets';
import { indexedDBManager } from '@/lib/storage/indexed-db-manager';

// URL cache to avoid recreating blob URLs
const urlCache = new Map<string, string>();

/**
 * Professional media URL resolver for local-first storage
 * Handles conversion from IndexedDB URLs to blob URLs
 */
export class MediaUrlResolver {
  /**
   * Resolve any media URL to a usable URL
   * Handles both IndexedDB URLs and regular URLs
   */
  static async resolveUrl(url: string): Promise<string> {
    // Handle IndexedDB URLs
    if (url.startsWith('indexeddb://')) {
      const localAssetId = url.replace('indexeddb://', '');
      
      // Check cache
      if (urlCache.has(localAssetId)) {
        return urlCache.get(localAssetId)!;
      }
      
      try {
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
        
        return blobUrl;
      } catch (error) {
        console.error('Failed to resolve IndexedDB URL:', error);
        return url; // Return original URL as fallback
      }
    }
    
    // Regular URLs pass through
    return url;
  }
  
  /**
   * Pre-resolve multiple URLs for performance
   */
  static async preResolveUrls(urls: string[]): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();
    
    await Promise.all(
      urls.map(async (url) => {
        try {
          const resolvedUrl = await this.resolveUrl(url);
          resolved.set(url, resolvedUrl);
        } catch (error) {
          console.error(`Failed to pre-resolve URL ${url}:`, error);
          resolved.set(url, url);
        }
      })
    );
    
    return resolved;
  }
  
  /**
   * Clean up cached URLs
   */
  static cleanup(): void {
    urlCache.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
    urlCache.clear();
  }
  
  /**
   * Check if URL needs resolution
   */
  static needsResolution(url: string): boolean {
    return url.startsWith('indexeddb://');
  }
}

// React hook for using media URLs
import { useState, useEffect } from 'react';

export function useResolvedMediaUrl(originalUrl: string): {
  url: string;
  isLoading: boolean;
  error: Error | null;
} {
  const [resolvedUrl, setResolvedUrl] = useState<string>(originalUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    if (MediaUrlResolver.needsResolution(originalUrl)) {
      setIsLoading(true);
      setError(null);
      
      MediaUrlResolver.resolveUrl(originalUrl)
        .then((url) => {
          if (!cancelled) {
            setResolvedUrl(url);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err);
            setResolvedUrl(originalUrl); // Fallback to original
            setIsLoading(false);
          }
        });
    } else {
      setResolvedUrl(originalUrl);
      setIsLoading(false);
      setError(null);
    }
    
    return () => {
      cancelled = true;
    };
  }, [originalUrl]);
  
  return { url: resolvedUrl, isLoading, error };
} 