// WebAssembly Thumbnail Generator - Client-side video processing
// Eliminates server requests and provides instant cached thumbnails

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { cacheDB } from '@/lib/storage/indexeddb-cache';
import { storageOrchestrator } from '@/lib/storage/storage-orchestrator';

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;

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

  private constructor() {}

  static getInstance(): WasmThumbnailGenerator {
    if (!WasmThumbnailGenerator.instance) {
      WasmThumbnailGenerator.instance = new WasmThumbnailGenerator();
    }
    return WasmThumbnailGenerator.instance;
  }

  // Initialize FFmpeg.wasm
  async initialize(): Promise<void> {
    if (this.ffmpeg) return;
    if (this.isLoading) {
      await ffmpegLoadPromise;
      return;
    }

    this.isLoading = true;
    
    try {
      console.log('🎬 Initializing WebAssembly video processor...');
      
      this.ffmpeg = new FFmpeg();
      
      // Configure FFmpeg for optimal performance
      this.ffmpeg.on('log', ({ message }) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('FFmpeg:', message);
        }
      });

      this.ffmpeg.on('progress', ({ progress, time }) => {
        // Progress tracking for long operations
        if (process.env.NODE_ENV === 'development') {
          console.log(`Processing: ${(progress * 100).toFixed(1)}% (${time}ms)`);
        }
      });

      // Load FFmpeg WebAssembly files
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      ffmpegLoadPromise = this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      }).then(() => {}); // Convert Promise<boolean> to Promise<void>

      await ffmpegLoadPromise;
      
      console.log('✅ WebAssembly video processor ready!');
      
      // Start processing queue
      this.startQueueProcessor();
      
    } catch (error) {
      console.error('Failed to initialize FFmpeg:', error);
      this.isLoading = false;
      this.ffmpeg = null;
      throw error;
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
      await this.initialize();
    }

    try {
      console.log(`📥 Loading video asset: ${assetId}`);
      
      // Fetch video data
      const response = await fetch(videoUrl);
      const videoData = await response.arrayBuffer();
      
      // Write to FFmpeg virtual filesystem
      const fileName = `video_${assetId}.mp4`;
      await this.ffmpeg!.writeFile(fileName, new Uint8Array(videoData));
      
      this.loadedAssets.set(assetId, fileName);
      console.log(`✅ Video loaded: ${assetId}`);
      
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

    const outputFile = `thumb_${Date.now()}.jpg`;
    
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
  async cleanup(): void {
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
    queueLength: number;
    loadedAssets: number;
  } {
    return {
      isReady: !!this.ffmpeg && !this.isLoading,
      queueLength: this.processingQueue.length,
      loadedAssets: this.loadedAssets.size
    };
  }
}

// Export singleton instance
export const thumbnailGenerator = WasmThumbnailGenerator.getInstance(); 