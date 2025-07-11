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
   * Handles IndexedDB URLs for local-first storage
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
        // First check if asset exists in IndexedDB
        const exists = await indexedDBManager.hasAsset(localAssetId);
        
        if (!exists) {
          console.error(`❌ Asset ${localAssetId} not found in IndexedDB - this asset needs to be re-uploaded`);
          throw new Error(`Asset ${localAssetId} not available locally`);
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
        
        return blobUrl;
      } catch (error) {
        console.error('❌ Failed to resolve IndexedDB URL:', error);
        throw error; // Don't return fallback - fail properly for local-first
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
import { useState, useEffect, useRef } from 'react';

export function useResolvedMediaUrl(originalUrl: string): {
  url: string;
  isLoading: boolean;
  error: Error | null;
} {
  const [resolvedUrl, setResolvedUrl] = useState<string>(originalUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Use ref to track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    // Reset state immediately when URL changes
    if (!originalUrl) {
      setResolvedUrl('');
      setIsLoading(false);
      setError(null);
      return;
    }
    
    // If URL doesn't need resolution, set it immediately
    if (!MediaUrlResolver.needsResolution(originalUrl)) {
      setResolvedUrl(originalUrl);
      setIsLoading(false);
      setError(null);
      return;
    }
    
    // Start resolution process
    setIsLoading(true);
    setError(null);
    
    let cancelled = false;
    
    const resolveUrl = async () => {
      try {
        const url = await MediaUrlResolver.resolveUrl(originalUrl);
        
        if (!cancelled && mountedRef.current) {
          setResolvedUrl(url);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          const error = err instanceof Error ? err : new Error('URL resolution failed');
          console.warn(`⚠️ URL resolution failed for ${originalUrl}:`, error.message);
          
          setError(error);
          setResolvedUrl(originalUrl); // Fallback to original
          setIsLoading(false);
        }
      }
    };
    
    resolveUrl();
    
    return () => {
      cancelled = true;
    };
  }, [originalUrl]); // Only depend on originalUrl to prevent infinite loops
  
  return { url: resolvedUrl, isLoading, error };
} 