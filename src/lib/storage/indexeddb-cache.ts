// IndexedDB cache layer for high-performance video editing
// Stores: thumbnails, waveforms, decoded frames, project cache

interface CacheEntry<T = any> {
  id: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
  size?: number;
}

interface VideoThumbnail {
  assetId: string;
  timeStamp: number;
  blob: Blob;
  width: number;
  height: number;
}

interface AudioWaveform {
  assetId: string;
  peaks: Float32Array;
  duration: number;
  sampleRate: number;
}

interface ProjectCache {
  projectId: string;
  projectData: any;
  thumbnails: string[]; // Asset IDs with cached thumbnails
  lastModified: number;
}

interface DecodedFrame {
  assetId: string;
  timestamp: number;
  imageData: ImageData;
  quality: 'low' | 'medium' | 'high';
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private dbName = 'VideoEditorCache';
  private version = 1;

  // Store definitions
  private stores = {
    thumbnails: 'thumbnails',
    waveforms: 'waveforms', 
    frames: 'frames',
    projects: 'projects',
    performance: 'performance'
  };

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Thumbnails store
        if (!db.objectStoreNames.contains(this.stores.thumbnails)) {
          const thumbnailStore = db.createObjectStore(this.stores.thumbnails, { keyPath: 'id' });
          thumbnailStore.createIndex('assetId', 'assetId', { unique: false });
          thumbnailStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Waveforms store
        if (!db.objectStoreNames.contains(this.stores.waveforms)) {
          const waveformStore = db.createObjectStore(this.stores.waveforms, { keyPath: 'id' });
          waveformStore.createIndex('assetId', 'assetId', { unique: true });
        }

        // Decoded frames store (for timeline scrubbing)
        if (!db.objectStoreNames.contains(this.stores.frames)) {
          const frameStore = db.createObjectStore(this.stores.frames, { keyPath: 'id' });
          frameStore.createIndex('assetId', 'assetId', { unique: false });
          frameStore.createIndex('timestamp', 'timestamp', { unique: false });
          frameStore.createIndex('quality', 'quality', { unique: false });
        }

        // Project cache store
        if (!db.objectStoreNames.contains(this.stores.projects)) {
          const projectStore = db.createObjectStore(this.stores.projects, { keyPath: 'projectId' });
          projectStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // Performance metrics store
        if (!db.objectStoreNames.contains(this.stores.performance)) {
          const perfStore = db.createObjectStore(this.stores.performance, { keyPath: 'id' });
          perfStore.createIndex('timestamp', 'timestamp', { unique: false });
          perfStore.createIndex('operation', 'operation', { unique: false });
        }
      };
    });
  }

  // === THUMBNAIL MANAGEMENT ===
  async storeThumbnail(thumbnail: VideoThumbnail): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `${thumbnail.assetId}_${thumbnail.timeStamp}`;
    const entry: CacheEntry<VideoThumbnail> = {
      id,
      data: thumbnail,
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      size: thumbnail.blob.size
    };

    return this.putData(this.stores.thumbnails, entry);
  }

  async getThumbnail(assetId: string, timestamp: number): Promise<VideoThumbnail | null> {
    if (!this.db) return null;

    const id = `${assetId}_${timestamp}`;
    const entry = await this.getData<VideoThumbnail>(this.stores.thumbnails, id);
    
    if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
      if (entry) await this.deleteData(this.stores.thumbnails, id);
      return null;
    }

    return entry.data;
  }

  async getThumbnailsForAsset(assetId: string): Promise<VideoThumbnail[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stores.thumbnails], 'readonly');
      const store = transaction.objectStore(this.stores.thumbnails);
      const index = store.index('assetId');
      const request = index.getAll(assetId);

      request.onsuccess = () => {
        const results = request.result
          .filter(entry => !entry.expiresAt || entry.expiresAt > Date.now())
          .map(entry => entry.data);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // === WAVEFORM MANAGEMENT ===
  async storeWaveform(waveform: AudioWaveform): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const entry: CacheEntry<AudioWaveform> = {
      id: waveform.assetId,
      data: waveform,
      timestamp: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
      size: waveform.peaks.byteLength
    };

    return this.putData(this.stores.waveforms, entry);
  }

  async getWaveform(assetId: string): Promise<AudioWaveform | null> {
    if (!this.db) return null;

    const entry = await this.getData<AudioWaveform>(this.stores.waveforms, assetId);
    
    if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
      if (entry) await this.deleteData(this.stores.waveforms, assetId);
      return null;
    }

    return entry.data;
  }

  // === DECODED FRAMES MANAGEMENT ===
  async storeDecodedFrame(frame: DecodedFrame): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `${frame.assetId}_${frame.timestamp}_${frame.quality}`;
    const entry: CacheEntry<DecodedFrame> = {
      id,
      data: frame,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours for frames
      size: frame.imageData.data.byteLength
    };

    return this.putData(this.stores.frames, entry);
  }

  async getDecodedFrame(
    assetId: string, 
    timestamp: number, 
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<DecodedFrame | null> {
    if (!this.db) return null;

    const id = `${assetId}_${timestamp}_${quality}`;
    const entry = await this.getData<DecodedFrame>(this.stores.frames, id);
    
    if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
      if (entry) await this.deleteData(this.stores.frames, id);
      return null;
    }

    return entry.data;
  }

  // === PROJECT CACHE MANAGEMENT ===
  async cacheProject(projectCache: ProjectCache): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const entry: CacheEntry<ProjectCache> = {
      id: projectCache.projectId,
      data: projectCache,
      timestamp: Date.now()
    };

    return this.putData(this.stores.projects, entry);
  }

  async getCachedProject(projectId: string): Promise<ProjectCache | null> {
    if (!this.db) return null;

    const entry = await this.getData<ProjectCache>(this.stores.projects, projectId);
    return entry?.data || null;
  }

  // === PERFORMANCE TRACKING ===
  async logPerformance(operation: string, duration: number, metadata?: any): Promise<void> {
    if (!this.db) return;

    const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const entry: CacheEntry = {
      id,
      data: {
        operation,
        duration,
        metadata,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // Keep performance data for 7 days
    };

    return this.putData(this.stores.performance, entry);
  }

  // === UTILITY METHODS ===
  private async putData(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getData<T>(storeName: string, key: string): Promise<CacheEntry<T> | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteData(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // === CACHE MANAGEMENT ===
  async clearExpiredData(): Promise<void> {
    if (!this.db) return;

    const now = Date.now();
    const stores = Object.values(this.stores);

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry = cursor.value;
            if (entry.expiresAt && entry.expiresAt < now) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getCacheSize(): Promise<{ [storeName: string]: number }> {
    if (!this.db) return {};

    const sizes: { [storeName: string]: number } = {};
    
    for (const storeName of Object.values(this.stores)) {
      sizes[storeName] = await new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.openCursor();
        let totalSize = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const entry = cursor.value;
            totalSize += entry.size || 0;
            cursor.continue();
          } else {
            resolve(totalSize);
          }
        };
        request.onerror = () => reject(request.error);
      });
    }

    return sizes;
  }

  async clearStore(storeName: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllCache(): Promise<void> {
    for (const storeName of Object.values(this.stores)) {
      await this.clearStore(storeName);
    }
  }
}

// Export singleton instance
export const cacheDB = new IndexedDBCache(); 