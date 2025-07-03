// WebAssembly Video Worker - Background processing for thumbnails and waveforms
// Keeps UI responsive while processing video assets

interface WorkerMessage {
  type: 'initialize' | 'generateThumbnail' | 'generateWaveform' | 'cleanup' | 'status';
  id: string;
  data?: any;
}

interface WorkerResponse {
  type: 'ready' | 'thumbnail' | 'waveform' | 'error' | 'progress' | 'status';
  id: string;
  data?: any;
  error?: string;
}

class VideoProcessingWorker {
  private static instance: VideoProcessingWorker;
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): VideoProcessingWorker {
    if (!VideoProcessingWorker.instance) {
      VideoProcessingWorker.instance = new VideoProcessingWorker();
    }
    return VideoProcessingWorker.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      try {
        // Create worker with inline code
        const workerCode = `
          // Worker imports
          importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
          const { FFmpeg } = self.FFmpeg;

          let ffmpeg = null;
          const loadedAssets = new Map();
          const thumbnailCache = new Map();

          // Initialize FFmpeg
          async function initializeFFmpeg() {
            ffmpeg = new FFmpeg();
            
            ffmpeg.on('log', ({ message }) => {
              console.log('[Worker FFmpeg]:', message);
            });

            ffmpeg.on('progress', ({ progress }) => {
              self.postMessage({
                type: 'progress',
                id: 'current',
                data: { progress }
              });
            });

            await ffmpeg.load();
            console.log('FFmpeg initialized in worker');
          }

          // Generate thumbnail
          async function generateThumbnail(id, { assetId, videoUrl, timestamp, width, height, quality }) {
            try {
              // Check cache first
              const cacheKey = \`\${assetId}_\${timestamp}_\${width}x\${height}_\${quality}\`;
              if (thumbnailCache.has(cacheKey)) {
                return thumbnailCache.get(cacheKey);
              }

              // Load video if needed
              if (!loadedAssets.has(assetId)) {
                const response = await fetch(videoUrl);
                const videoData = await response.arrayBuffer();
                const fileName = \`video_\${assetId}.mp4\`;
                await ffmpeg.writeFile(fileName, new Uint8Array(videoData));
                loadedAssets.set(assetId, fileName);
              }

              const fileName = loadedAssets.get(assetId);
              const outputFile = \`thumb_\${Date.now()}.jpg\`;

              // Quality settings
              const qualityMap = {
                low: { scale: 0.5, qscale: 5 },
                medium: { scale: 1, qscale: 2 },
                high: { scale: 1, qscale: 1 }
              };
              
              const { scale, qscale } = qualityMap[quality];
              const scaledWidth = Math.round(width * scale);
              const scaledHeight = Math.round(height * scale);

              // Extract frame
              await ffmpeg.exec([
                '-ss', timestamp.toString(),
                '-i', fileName,
                '-vframes', '1',
                '-vf', \`scale=\${scaledWidth}:\${scaledHeight}\`,
                '-q:v', qscale.toString(),
                outputFile
              ]);

              // Read thumbnail
              const data = await ffmpeg.readFile(outputFile);
              await ffmpeg.deleteFile(outputFile);

              // Convert to base64 for transfer
              const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
              
              // Cache result
              thumbnailCache.set(cacheKey, base64);
              
              return base64;
            } catch (error) {
              throw new Error(\`Thumbnail generation failed: \${error.message}\`);
            }
          }

          // Message handler
          self.addEventListener('message', async (event) => {
            const { type, id, data } = event.data;

            try {
              switch (type) {
                case 'initialize':
                  await initializeFFmpeg();
                  self.postMessage({ type: 'ready', id });
                  break;

                case 'generateThumbnail':
                  const thumbnail = await generateThumbnail(id, data);
                  self.postMessage({ type: 'thumbnail', id, data: thumbnail });
                  break;

                case 'cleanup':
                  // Clean up loaded assets
                  for (const [assetId, fileName] of loadedAssets) {
                    try {
                      await ffmpeg.deleteFile(fileName);
                    } catch (e) {}
                  }
                  loadedAssets.clear();
                  thumbnailCache.clear();
                  self.postMessage({ type: 'status', id, data: 'cleaned' });
                  break;

                case 'status':
                  self.postMessage({
                    type: 'status',
                    id,
                    data: {
                      isReady: !!ffmpeg,
                      loadedAssets: loadedAssets.size,
                      cacheSize: thumbnailCache.size
                    }
                  });
                  break;

                default:
                  throw new Error(\`Unknown message type: \${type}\`);
              }
            } catch (error) {
              self.postMessage({
                type: 'error',
                id,
                error: error.message
              });
            }
          });
        `;

        // Create blob URL for worker
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        
        this.worker = new Worker(workerUrl);

        // Handle worker messages
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const { type, id, data, error } = event.data;

          if (type === 'ready' && id === 'init') {
            this.isInitialized = true;
            resolve();
            return;
          }

          const pending = this.pendingRequests.get(id);
          if (pending) {
            if (error) {
              pending.reject(new Error(error));
            } else {
              pending.resolve(data);
            }
            this.pendingRequests.delete(id);
          }
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          reject(error);
        };

        // Initialize worker
        this.sendMessage('initialize', 'init');

      } catch (error) {
        console.error('Failed to create worker:', error);
        reject(error);
      }
    });
  }

  private sendMessage(type: string, id: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, data });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Worker request timeout'));
        }
      }, 30000);
    });
  }

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
    const { width = 160, height = 90, quality = 'medium' } = options;
    
    const id = `thumb_${assetId}_${timestamp}_${Date.now()}`;
    
    try {
      const base64 = await this.sendMessage('generateThumbnail', id, {
        assetId,
        videoUrl,
        timestamp,
        width,
        height,
        quality
      });

      // Convert base64 back to blob
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return new Blob([bytes], { type: 'image/jpeg' });
      
    } catch (error) {
      console.error('Worker thumbnail generation failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.sendMessage('cleanup', 'cleanup');
    }
  }

  async getStatus(): Promise<any> {
    if (!this.worker) return null;
    return this.sendMessage('status', 'status');
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.pendingRequests.clear();
    }
  }
}

export const videoWorker = VideoProcessingWorker.getInstance();

// Export a simple thumbnail generation function
export async function generateThumbnailWasm(
  assetId: string,
  videoUrl: string,
  timestamp: number,
  options?: {
    width?: number;
    height?: number;
    quality?: 'low' | 'medium' | 'high';
  }
): Promise<Blob> {
  // Initialize worker if needed
  if (!videoWorker['isInitialized']) {
    await videoWorker.initialize();
  }
  
  return videoWorker.generateThumbnail(assetId, videoUrl, timestamp, options);
} 