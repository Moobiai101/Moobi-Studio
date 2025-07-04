// WebAssembly Thumbnail Generator - Client-side video processing
// Eliminates server requests and provides instant cached thumbnails

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { cacheDB } from '@/lib/storage/indexeddb-cache';
import { storageOrchestrator } from '@/lib/storage/storage-orchestrator';

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<boolean> | null = null;

// Feature detection and fallback management
let isWebAssemblySupported = false;
let initializationFailed = false;

// Check WebAssembly support
try {
  isWebAssemblySupported = typeof WebAssembly !== 'undefined' && 
                          typeof WebAssembly.instantiate === 'function';
} catch (error) {
  console.warn('WebAssembly not supported:', error);
}

// Thumbnail generation queue for efficient processing
interface ThumbnailRequest {
  assetId: string;
  timestamp: number;
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high';
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
}

class WasmThumbnailGenerator {
  private static instance: WasmThumbnailGenerator;
  private ffmpeg: FFmpeg | null = null;
  private isLoading = false;
  private processingQueue: ThumbnailRequest[] = [];
  private isProcessing = false;
  private loadedAssets: Map<string, string> = new Map(); // Cache loaded video URLs
  private initializationAttempts = 0;
  private maxInitializationAttempts = 3;

  private constructor() {}

  static getInstance(): WasmThumbnailGenerator {
    if (!WasmThumbnailGenerator.instance) {
      WasmThumbnailGenerator.instance = new WasmThumbnailGenerator();
    }
    return WasmThumbnailGenerator.instance;
  }

  // Check if WebAssembly processing is available
  isAvailable(): boolean {
    return isWebAssemblySupported && !initializationFailed && this.ffmpeg !== null;
  }

  // Initialize FFmpeg.wasm with multiple fallback strategies
  async initialize(): Promise<boolean> {
    if (this.ffmpeg) return true;
    if (initializationFailed) return false;
    if (this.isLoading) {
      const result = await ffmpegLoadPromise;
      return result || false;
    }

    this.isLoading = true;
    this.initializationAttempts++;

    try {
      console.log('🎬 Initializing WebAssembly video processor...');
      
      if (!isWebAssemblySupported) {
        throw new Error('WebAssembly not supported in this environment');
      }

      this.ffmpeg = new FFmpeg();
      
      // Configure FFmpeg for optimal performance
      this.ffmpeg.on('log', ({ message }) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('FFmpeg:', message);
        }
      });

      this.ffmpeg.on('progress', ({ progress, time }) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Processing: ${(progress * 100).toFixed(1)}% (${time}ms)`);
        }
      });

      // Simplified CDN fallback strategy for better reliability
      const cdnUrls = [
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
      ];

      let loadSuccess = false;
      let lastError: Error | null = null;

      for (const baseURL of cdnUrls) {
        try {
          console.log(`🎬 Attempting to load FFmpeg from: ${baseURL}`);
          
          // Simplified loading without worker URL to avoid cross-origin issues
          ffmpegLoadPromise = this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });

          const result = await ffmpegLoadPromise;
          loadSuccess = true;
          console.log('✅ WebAssembly video processor ready!');
          break;
          
        } catch (error) {
          lastError = error as Error;
          console.warn(`Failed to load from ${baseURL}:`, error);
          continue;
        }
      }

      if (!loadSuccess) {
        throw lastError || new Error('Failed to load FFmpeg from all CDNs');
      }

      // Start processing queue
      this.startQueueProcessor();
      this.isLoading = false;
      
      return true;
      
    } catch (error) {
      console.error('Failed to initialize FFmpeg after', this.initializationAttempts, 'attempts:', error);
      
      // Always mark as failed to prevent further attempts
      initializationFailed = true;
      console.warn('🚫 WebAssembly thumbnail generation permanently disabled - using placeholder images');
      
      this.isLoading = false;
      this.ffmpeg = null;
      ffmpegLoadPromise = null;
      
      return false;
    }
  }

  // Generate thumbnail for a video at specific timestamp
  async generateThumbnail(
    assetId: string,
    videoUrl: string,
    timestamp: number,
    options: {
      width?: number;
      height?: number;
      quality?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<Blob> {
    // Early return if WebAssembly is not available
    if (!isWebAssemblySupported || initializationFailed) {
      throw new Error('WebAssembly thumbnail generation not available');
    }

    const { 
      width = 160, 
      height = 90, 
      quality = 'medium' 
    } = options;

    // Check cache first
    const cachedThumbnail = await cacheDB.getThumbnail(assetId, timestamp);
    if (cachedThumbnail) {
      console.log(`📸 Thumbnail cache hit: ${assetId} @ ${timestamp}s`);
      return cachedThumbnail.blob;
    }

    // Try to initialize if not already done
    const initialized = await this.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize WebAssembly video processor');
    }

    // Add to processing queue
    return new Promise((resolve, reject) => {
      this.processingQueue.push({
        assetId,
        timestamp,
        width,
        height,
        quality,
        resolve,
        reject
      });

      // Load video if not already loaded
      if (!this.loadedAssets.has(assetId)) {
        this.loadVideoAsset(assetId, videoUrl);
      }
    });
  }

  // Load video asset into FFmpeg virtual filesystem
  private async loadVideoAsset(assetId: string, videoUrl: string): Promise<void> {
    if (!this.ffmpeg) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize FFmpeg');
      }
    }

    try {
      console.log(`📥 Loading video asset: ${assetId}`);
      
      // Fetch video data with proper headers
      const response = await fetch(videoUrl, {
        headers: {
          'Accept': 'video/*',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }
      
      const videoData = await response.arrayBuffer();
      
      // Write to FFmpeg virtual filesystem
      const fileName = `video_${assetId}.mp4`;
      await this.ffmpeg!.writeFile(fileName, new Uint8Array(videoData));
      
      this.loadedAssets.set(assetId, fileName);
      console.log(`✅ Video loaded: ${assetId} (${(videoData.byteLength / 1024 / 1024).toFixed(2)}MB)`);
      
      // Process any pending requests for this asset
      this.processQueue();
      
    } catch (error) {
      console.error(`Failed to load video ${assetId}:`, error);
      
      // Reject all pending requests for this asset
      this.processingQueue
        .filter(req => req.assetId === assetId)
        .forEach(req => req.reject(error as Error));
      
      // Remove failed requests from queue
      this.processingQueue = this.processingQueue.filter(req => req.assetId !== assetId);
    }
  }

  // Process thumbnail generation queue
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        this.processQueue();
      }
    }, 100);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0 || !this.ffmpeg) return;
    
    this.isProcessing = true;

    try {
      // Group requests by asset for efficient processing
      const requestsByAsset = new Map<string, ThumbnailRequest[]>();
      
      this.processingQueue.forEach(req => {
        if (this.loadedAssets.has(req.assetId)) {
          const requests = requestsByAsset.get(req.assetId) || [];
          requests.push(req);
          requestsByAsset.set(req.assetId, requests);
        }
      });

      // Process each asset's thumbnails
      for (const [assetId, requests] of requestsByAsset) {
        const fileName = this.loadedAssets.get(assetId)!;
        
        // Sort by timestamp for sequential processing
        requests.sort((a, b) => a.timestamp - b.timestamp);
        
        for (const request of requests) {
          try {
            const thumbnail = await this.extractFrame(
              fileName,
              request.timestamp,
              request.width,
              request.height,
              request.quality
            );

            // Cache the thumbnail
            await storageOrchestrator.storeThumbnail(
              assetId,
              request.timestamp,
              thumbnail,
              { width: request.width, height: request.height }
            );

            // Resolve the request
            request.resolve(thumbnail);
            
            // Remove from queue
            const index = this.processingQueue.indexOf(request);
            if (index > -1) {
              this.processingQueue.splice(index, 1);
            }
            
          } catch (error) {
            console.error(`Failed to generate thumbnail for ${assetId} @ ${request.timestamp}s:`, error);
            request.reject(error as Error);
            
            // Remove from queue
            const index = this.processingQueue.indexOf(request);
            if (index > -1) {
              this.processingQueue.splice(index, 1);
            }
          }
        }
      }
      
    } finally {
      this.isProcessing = false;
    }
  }

  // Extract a single frame from video
  private async extractFrame(
    fileName: string,
    timestamp: number,
    width: number,
    height: number,
    quality: 'low' | 'medium' | 'high'
  ): Promise<Blob> {
    if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

    const outputFile = `thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    // Quality settings
    const qualityMap = {
      low: { scale: 0.5, qscale: 5 },
      medium: { scale: 1, qscale: 2 },
      high: { scale: 1, qscale: 1 }
    };
    
    const { scale, qscale } = qualityMap[quality];
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    try {
      // Extract frame at timestamp
      await this.ffmpeg.exec([
        '-ss', timestamp.toString(),
        '-i', fileName,
        '-vframes', '1',
        '-vf', `scale=${scaledWidth}:${scaledHeight}`,
        '-q:v', qscale.toString(),
        '-y', // Overwrite output file
        outputFile
      ]);

      // Read the generated thumbnail
      const data = await this.ffmpeg.readFile(outputFile);
      const blob = new Blob([data], { type: 'image/jpeg' });

      // Clean up
      await this.ffmpeg.deleteFile(outputFile);

      return blob;
      
    } catch (error) {
      console.error('Frame extraction failed:', error);
      // Clean up on error
      try {
        await this.ffmpeg.deleteFile(outputFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  // Generate multiple thumbnails for a video (for timeline)
  async generateTimelineThumbnails(
    assetId: string,
    videoUrl: string,
    duration: number,
    options: {
      count?: number;
      width?: number;
      height?: number;
      quality?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<Blob[]> {
    if (!isWebAssemblySupported || initializationFailed) {
      throw new Error('WebAssembly thumbnail generation not available');
    }

    const { 
      count = 10, 
      width = 160, 
      height = 90, 
      quality = 'low' // Low quality for timeline 
    } = options;

    const interval = duration / count;
    const timestamps = Array.from({ length: count }, (_, i) => i * interval);
    
    console.log(`🎬 Generating ${count} timeline thumbnails for ${assetId}`);

    // Generate all thumbnails in parallel
    const thumbnailPromises = timestamps.map(timestamp =>
      this.generateThumbnail(assetId, videoUrl, timestamp, { width, height, quality })
    );

    return Promise.all(thumbnailPromises);
  }

  // Clean up resources
  async cleanup(): Promise<void> {
    if (this.ffmpeg) {
      // Remove all loaded videos from virtual filesystem
      for (const [assetId, fileName] of this.loadedAssets) {
        try {
          await this.ffmpeg.deleteFile(fileName);
        } catch (error) {
          console.warn(`Failed to clean up ${fileName}:`, error);
        }
      }
      
      this.loadedAssets.clear();
      this.processingQueue = [];
    }
  }

  // Get processing status
  getStatus(): {
    isReady: boolean;
    isAvailable: boolean;
    queueLength: number;
    loadedAssets: number;
    initializationFailed: boolean;
  } {
    return {
      isReady: !!this.ffmpeg && !this.isLoading,
      isAvailable: this.isAvailable(),
      queueLength: this.processingQueue.length,
      loadedAssets: this.loadedAssets.size,
      initializationFailed
    };
  }
}

// Export singleton instance
export const thumbnailGenerator = WasmThumbnailGenerator.getInstance(); 