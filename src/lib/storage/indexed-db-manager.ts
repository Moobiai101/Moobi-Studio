import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Professional storage configuration
const DB_NAME = 'ai_creative_suite_storage';
const DB_VERSION = 1;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for optimal performance

// Database schema
interface CreativeSuiteDB extends DBSchema {
  // Media assets stored in chunks
  media_chunks: {
    key: string;
    value: {
      chunkId: string;        // Format: assetId_chunkIndex
      assetId: string;
      chunkIndex: number;
      data: Blob;
      totalChunks: number;
      created: Date;
    };
    indexes: { 
      'by-asset': string;
      'by-created': Date;
    };
  };
  
  // Asset metadata (lightweight)
  asset_metadata: {
    key: string;
    value: {
      assetId: string;
      localAssetId: string;
      filename: string;
      contentType: string;
      size: number;
      totalChunks: number;
      duration?: number;
      dimensions?: { width: number; height: number };
      created: Date;
      lastAccessed: Date;
      checksum?: string;
    };
  };
  
  // Thumbnails and filmstrips
  media_cache: {
    key: string;
    value: {
      cacheId: string;        // Format: assetId_type_quality
      assetId: string;
      type: 'thumbnail' | 'filmstrip' | 'waveform';
      data: Blob;
      metadata: any;
      created: Date;
    };
    indexes: { 
      'by-asset': string;
      'by-type': string;
    };
  };
  
  // Project recovery data
  recovery_data: {
    key: string;
    value: {
      projectId: string;
      deviceFingerprint: string;
      lastSaved: Date;
      projectState: any;
      assetManifest: any[];
    };
    indexes: { 
      'by-device': string;
      'by-project': string;
    };
  };
}

class IndexedDBManager {
  private db: IDBPDatabase<CreativeSuiteDB> | null = null;
  private initPromise: Promise<void> | null = null;
  
  private isClientSide(): boolean {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
  }
  
  async initialize(): Promise<void> {
    // Skip initialization if not in browser environment
    if (!this.isClientSide()) {
      console.warn('IndexedDB not available (server-side rendering)');
      return;
    }
    
    if (this.db) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.performInit();
    await this.initPromise;
  }
  
  private async performInit(): Promise<void> {
    try {
      this.db = await openDB<CreativeSuiteDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Media chunks store
          if (!db.objectStoreNames.contains('media_chunks')) {
            const chunkStore = db.createObjectStore('media_chunks', {
              keyPath: 'chunkId'
            });
            chunkStore.createIndex('by-asset', 'assetId');
            chunkStore.createIndex('by-created', 'created');
          }
          
          // Asset metadata store
          if (!db.objectStoreNames.contains('asset_metadata')) {
            db.createObjectStore('asset_metadata', {
              keyPath: 'assetId'
            });
          }
          
          // Media cache store
          if (!db.objectStoreNames.contains('media_cache')) {
            const cacheStore = db.createObjectStore('media_cache', {
              keyPath: 'cacheId'
            });
            cacheStore.createIndex('by-asset', 'assetId');
            cacheStore.createIndex('by-type', 'type');
          }
          
          // Recovery data store
          if (!db.objectStoreNames.contains('recovery_data')) {
            const recoveryStore = db.createObjectStore('recovery_data', {
              keyPath: 'projectId'
            });
            recoveryStore.createIndex('by-device', 'deviceFingerprint');
            recoveryStore.createIndex('by-project', 'projectId');
          }
        }
      });
      
      console.log('✅ IndexedDB initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize IndexedDB:', error);
      throw error;
    }
  }
  
  // ===== CHUNKED FILE STORAGE =====
  
  async storeMediaAsset(file: File): Promise<string> {
    if (!this.isClientSide()) {
      throw new Error('IndexedDB not available (server-side rendering)');
    }
    
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const assetId = crypto.randomUUID();
    const localAssetId = `local_${assetId}`;
    const chunks = await this.chunkFile(file);
    
    // Start transaction for atomic operation
    const tx = this.db.transaction(['media_chunks', 'asset_metadata'], 'readwrite');
    
    try {
      // Store chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${assetId}_${i}`;
        await tx.objectStore('media_chunks').put({
          chunkId,
          assetId,
          chunkIndex: i,
          data: chunks[i],
          totalChunks: chunks.length,
          created: new Date()
        });
      }
      
      // Store metadata
      await tx.objectStore('asset_metadata').put({
        assetId,
        localAssetId,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        totalChunks: chunks.length,
        created: new Date(),
        lastAccessed: new Date()
      });
      
      await tx.done;
      console.log(`✅ Stored ${file.name} in ${chunks.length} chunks`);
      
      return localAssetId;
    } catch (error) {
      console.error('❌ Failed to store media asset:', error);
      throw error;
    }
  }
  
  async getMediaAssetBlob(localAssetId: string): Promise<Blob> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    // Extract assetId from localAssetId
    const assetId = localAssetId.replace('local_', '');
    
    // Get metadata
    const metadata = await this.db.get('asset_metadata', assetId);
    if (!metadata) {
      throw new Error('Asset not found');
    }
    
    // Get all chunks with validation
    const chunks: Blob[] = new Array(metadata.totalChunks);
    const tx = this.db.transaction('media_chunks', 'readonly');
    const index = tx.objectStore('media_chunks').index('by-asset');
    
    let foundChunks = 0;
    for await (const cursor of index.iterate(assetId)) {
      if (cursor.value.chunkIndex < metadata.totalChunks) {
        chunks[cursor.value.chunkIndex] = cursor.value.data;
        foundChunks++;
      }
    }
    
    // Validate that all chunks are present
    if (foundChunks !== metadata.totalChunks) {
      console.error(`🚫 Asset ${localAssetId} is corrupted: found ${foundChunks}/${metadata.totalChunks} chunks`);
      throw new Error(`Asset corrupted: missing ${metadata.totalChunks - foundChunks} chunks`);
    }
    
    // Check for any undefined chunks
    for (let i = 0; i < chunks.length; i++) {
      if (!chunks[i]) {
        console.error(`🚫 Asset ${localAssetId} missing chunk ${i}`);
        throw new Error(`Asset corrupted: chunk ${i} is missing`);
      }
    }
    
    // Update last accessed
    await this.db.put('asset_metadata', {
      ...metadata,
      lastAccessed: new Date()
    });
    
    // Reconstruct blob
    return new Blob(chunks, { type: metadata.contentType });
  }
  
  async getMediaAssetUrl(localAssetId: string): Promise<string> {
    const blob = await this.getMediaAssetBlob(localAssetId);
    return URL.createObjectURL(blob);
  }
  
  // ===== CACHE MANAGEMENT =====
  
  async storeThumbnail(assetId: string, thumbnail: Blob): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const cacheId = `${assetId}_thumbnail_high`;
    
    await this.db.put('media_cache', {
      cacheId,
      assetId,
      type: 'thumbnail',
      data: thumbnail,
      metadata: { quality: 'high' },
      created: new Date()
    });
  }
  
  async getThumbnail(assetId: string): Promise<string | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const cacheId = `${assetId}_thumbnail_high`;
    const cached = await this.db.get('media_cache', cacheId);
    
    if (!cached) return null;
    
    return URL.createObjectURL(cached.data);
  }
  
  async storeFilmstrip(assetId: string, filmstrip: Blob, metadata: any): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const cacheId = `${assetId}_filmstrip_${metadata.frameCount}`;
    
    await this.db.put('media_cache', {
      cacheId,
      assetId,
      type: 'filmstrip',
      data: filmstrip,
      metadata,
      created: new Date()
    });
  }
  
  async getFilmstrip(assetId: string, frameCount: number): Promise<string | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const cacheId = `${assetId}_filmstrip_${frameCount}`;
    const cached = await this.db.get('media_cache', cacheId);
    
    if (!cached) return null;
    
    return URL.createObjectURL(cached.data);
  }
  
  // ===== RECOVERY SYSTEM =====
  
  async saveRecoveryPoint(projectId: string, deviceFingerprint: string, projectState: any, assetManifest: any[]): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.put('recovery_data', {
      projectId,
      deviceFingerprint,
      lastSaved: new Date(),
      projectState,
      assetManifest
    });
  }
  
  async getRecoveryPoint(projectId: string): Promise<any | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.get('recovery_data', projectId);
  }
  
  // ===== STORAGE MANAGEMENT =====
  
  async getStorageInfo(): Promise<{
    used: number;
    available: number;
    quota: number;
    usage: {
      chunks: number;
      cache: number;
      recovery: number;
    };
  }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const estimate = await navigator.storage.estimate();
    
    // Calculate usage by type
    let chunksSize = 0;
    let cacheSize = 0;
    let recoverySize = 0;
    
    // Count chunks
    const chunkTx = this.db.transaction('media_chunks', 'readonly');
    for await (const cursor of chunkTx.objectStore('media_chunks').iterate()) {
      chunksSize += cursor.value.data.size;
    }
    
    // Count cache
    const cacheTx = this.db.transaction('media_cache', 'readonly');
    for await (const cursor of cacheTx.objectStore('media_cache').iterate()) {
      cacheSize += cursor.value.data.size;
    }
    
    return {
      used: estimate.usage || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0),
      quota: estimate.quota || 0,
      usage: {
        chunks: chunksSize,
        cache: cacheSize,
        recovery: recoverySize
      }
    };
  }
  
  async cleanupOldCache(daysOld: number = 7): Promise<number> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;
    const tx = this.db.transaction('media_cache', 'readwrite');
    
    for await (const cursor of tx.objectStore('media_cache').iterate()) {
      if (cursor.value.created < cutoffDate) {
        await cursor.delete();
        deletedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${deletedCount} old cache entries`);
    return deletedCount;
  }
  
  // ===== UTILITY METHODS =====
  
  private async chunkFile(file: File): Promise<Blob[]> {
    const chunks: Blob[] = [];
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      chunks.push(chunk);
      offset += CHUNK_SIZE;
    }
    
    return chunks;
  }
  
  async deleteAsset(localAssetId: string): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    const assetId = localAssetId.replace('local_', '');
    
    const tx = this.db.transaction(['media_chunks', 'asset_metadata', 'media_cache'], 'readwrite');
    
    // Delete chunks
    const chunkIndex = tx.objectStore('media_chunks').index('by-asset');
    for await (const cursor of chunkIndex.iterate(assetId)) {
      await cursor.delete();
    }
    
    // Delete metadata
    await tx.objectStore('asset_metadata').delete(assetId);
    
    // Delete cache
    const cacheIndex = tx.objectStore('media_cache').index('by-asset');
    for await (const cursor of cacheIndex.iterate(assetId)) {
      await cursor.delete();
    }
    
    await tx.done;
  }

  // ===== ASSET VALIDATION =====
  
  async validateAssetIntegrity(localAssetId: string): Promise<{ valid: boolean; error?: string; missingChunks?: number[] }> {
    try {
      await this.initialize();
      if (!this.db) return { valid: false, error: 'Database not initialized' };
      
      const assetId = localAssetId.replace('local_', '');
      
      // Check metadata exists
      const metadata = await this.db.get('asset_metadata', assetId);
      if (!metadata) {
        return { valid: false, error: 'Asset metadata not found' };
      }
      
      // Check chunks
      const foundChunks = new Set<number>();
      const tx = this.db.transaction('media_chunks', 'readonly');
      const index = tx.objectStore('media_chunks').index('by-asset');
      
      for await (const cursor of index.iterate(assetId)) {
        foundChunks.add(cursor.value.chunkIndex);
      }
      
      // Find missing chunks
      const missingChunks: number[] = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        if (!foundChunks.has(i)) {
          missingChunks.push(i);
        }
      }
      
      if (missingChunks.length > 0) {
        return { 
          valid: false, 
          error: `Missing ${missingChunks.length} chunks`, 
          missingChunks 
        };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  async listCorruptedAssets(): Promise<Array<{ localAssetId: string; error: string; missingChunks?: number[] }>> {
    try {
      await this.initialize();
      if (!this.db) return [];
      
      const corruptedAssets: Array<{ localAssetId: string; error: string; missingChunks?: number[] }> = [];
      
      // Get all metadata
      const allMetadata = await this.db.getAll('asset_metadata');
      
      for (const metadata of allMetadata) {
        const localAssetId = `local_${metadata.assetId}`;
        const validation = await this.validateAssetIntegrity(localAssetId);
        
        if (!validation.valid) {
          corruptedAssets.push({
            localAssetId,
            error: validation.error || 'Unknown error',
            missingChunks: validation.missingChunks
          });
        }
      }
      
      return corruptedAssets;
    } catch (error) {
      console.error('Error listing corrupted assets:', error);
      return [];
    }
  }
  
  async cleanupCorruptedAssets(): Promise<{ removed: number; errors: string[] }> {
    try {
      await this.initialize();
      if (!this.db) return { removed: 0, errors: ['Database not initialized'] };
      
      const corruptedAssets = await this.listCorruptedAssets();
      const errors: string[] = [];
      let removed = 0;
      
      for (const corrupted of corruptedAssets) {
        try {
          await this.deleteAsset(corrupted.localAssetId);
          console.log(`🗑️ Removed corrupted asset: ${corrupted.localAssetId}`);
          removed++;
        } catch (error) {
          const errorMsg = `Failed to remove ${corrupted.localAssetId}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
      
      return { removed, errors };
    } catch (error) {
      return { 
        removed: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }
}

// Singleton instance
export const indexedDBManager = new IndexedDBManager();

// Only initialize on client side (browser environment)
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
indexedDBManager.initialize().catch(console.error); 
} 