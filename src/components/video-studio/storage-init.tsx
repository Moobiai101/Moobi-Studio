'use client';

import { useEffect, useState } from 'react';
import { storageOrchestrator } from '@/lib/storage/storage-orchestrator';
import { VideoProjectService } from '@/services/video-projects';
import { toast } from 'sonner';

interface StorageInitProps {
  children: React.ReactNode;
  onInitialized?: () => void;
}

interface InitStatus {
  step: string;
  progress: number;
  error?: string;
}

export function StorageInitializer({ children, onInitialized }: StorageInitProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initStatus, setInitStatus] = useState<InitStatus>({
    step: 'Starting...',
    progress: 0
  });

  useEffect(() => {
    // Only initialize storage in browser environment
    if (typeof window !== 'undefined') {
      initializeStorage();
    }
  }, []);

  const initializeStorage = async () => {
    try {
      // Step 1: Initialize storage orchestrator
      setInitStatus({ step: 'Initializing storage system...', progress: 20 });
      await storageOrchestrator.initialize();
      
      // Step 2: Detect device capabilities
      setInitStatus({ step: 'Detecting device capabilities...', progress: 40 });
      const deviceCapabilities = await VideoProjectService.detectDeviceCapabilities();
      
      // Show device capability information
      if (deviceCapabilities.capabilities.webassembly_supported) {
        console.log('✅ WebAssembly supported - High performance mode available');
      } else {
        console.warn('⚠️ WebAssembly not supported - Falling back to JavaScript processing');
      }
      
      // Step 3: Optimize cache
      setInitStatus({ step: 'Optimizing cache...', progress: 60 });
      await VideoProjectService.optimizeCache();
      
      // Step 4: Get performance metrics
      setInitStatus({ step: 'Loading performance data...', progress: 80 });
      const metrics = await VideoProjectService.getPerformanceMetrics();
      
      // Step 5: Complete initialization
      setInitStatus({ step: 'Ready!', progress: 100 });
      
      // Log performance metrics for development
      console.log('Storage Performance Metrics:', {
        cacheHitRate: `${(metrics.storage.cacheHitRate * 100).toFixed(1)}%`,
        averageLoadTime: `${metrics.storage.averageLoadTime.toFixed(2)}ms`,
        cacheSize: formatBytes(Object.values(metrics.cache).reduce((sum: number, size: unknown) => sum + (typeof size === 'number' ? size : 0), 0))
      });
      
      // Show success message with device-specific information
      toast.success(
        `Video Studio initialized! ${deviceCapabilities.capabilities.webassembly_supported 
          ? 'WebAssembly acceleration enabled' 
          : 'JavaScript fallback mode'
        }`,
        {
          description: `Performance preset: ${deviceCapabilities.performance_profile.recommended_quality}`
        }
      );
      
      setIsInitialized(true);
      onInitialized?.();
      
    } catch (error) {
      console.error('Storage initialization failed:', error);
      
      setInitStatus({
        step: 'Initialization failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast.error('Video Studio initialization failed', {
        description: 'Some features may not work properly. Please refresh the page.',
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        }
      });
      
      // Still allow the app to load even if initialization fails
      setIsInitialized(true);
      onInitialized?.();
    }
  };

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Initializing Video Studio
            </h2>
            <p className="text-sm text-muted-foreground">
              Setting up high-performance video editing...
            </p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                initStatus.error ? 'bg-destructive' : 'bg-primary'
              }`}
              style={{ width: `${initStatus.progress}%` }}
            />
          </div>
          
          {/* Status text */}
          <p className={`text-sm ${initStatus.error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {initStatus.error || initStatus.step}
          </p>
          
          {initStatus.error && (
            <button
              onClick={initializeStorage}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          )}
          
          {/* Device detection info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div>🧠 Detecting CPU cores: {typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 'Unknown') : 'Unknown'}</div>
            <div>💾 Memory estimate: {typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 'Unknown') : 'Unknown'}GB</div>
            <div>⚡ WebAssembly: {typeof WebAssembly !== 'undefined' ? 'Supported' : 'Not supported'}</div>
          </div>
        </div>
      </div>
    );
  }

  // Render children once initialized
  return <>{children}</>;
}

// Storage status component for debugging/monitoring
export function StorageStatus() {
  const [metrics, setMetrics] = useState<any>(null);
  const [cacheSize, setCacheSize] = useState<any>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const performanceMetrics = await VideoProjectService.getPerformanceMetrics();
        setMetrics(performanceMetrics);
        setCacheSize(performanceMetrics.cache);
      } catch (error) {
        console.error('Failed to load storage metrics:', error);
      }
    };

    loadMetrics();
    
    // Update metrics every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-3 text-xs space-y-1 shadow-lg max-w-64">
      <div className="font-semibold text-foreground">Storage Status</div>
      
      <div className="space-y-1 text-muted-foreground">
        <div>Cache Hit Rate: {(metrics.storage.cacheHitRate * 100).toFixed(1)}%</div>
        <div>Avg Load Time: {metrics.storage.averageLoadTime.toFixed(2)}ms</div>
        
        {cacheSize && (
          <div>Cache Size: {formatBytes(
            Object.values(cacheSize).reduce((sum: number, size: unknown) => sum + (typeof size === 'number' ? size : 0), 0)
          )}</div>
        )}
      </div>
      
      <div className="pt-1 border-t">
        <button
          onClick={() => VideoProjectService.optimizeCache()}
          className="text-primary hover:underline text-xs"
        >
          Optimize Cache
        </button>
        {' • '}
        <button
          onClick={() => VideoProjectService.clearCache()}
          className="text-destructive hover:underline text-xs"
        >
          Clear Cache
        </button>
      </div>
    </div>
  );
}

// Utility function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
} 