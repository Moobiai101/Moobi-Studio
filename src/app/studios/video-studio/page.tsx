"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import components to prevent SSR issues
const VideoProjectProvider = dynamic(
  () => import("@/components/video-studio/providers/video-project-provider").then(mod => ({ default: mod.VideoProjectProvider })),
  { ssr: false }
);

const VideoEditor = dynamic(
  () => import("@/components/video-studio/components/video-editor").then(mod => ({ default: mod.VideoEditor })),
  { ssr: false }
);

const StorageInitializer = dynamic(
  () => import("@/components/video-studio/storage-init").then(mod => ({ default: mod.StorageInitializer })),
  { ssr: false }
);

const StorageStatus = dynamic(
  () => import("@/components/video-studio/storage-init").then(mod => ({ default: mod.StorageStatus })),
  { ssr: false }
);

// Loading component
const VideoStudioLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Loading Video Studio...</h2>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  </div>
);

export default function VideoStudioPage() {
  return (
    <Suspense fallback={<VideoStudioLoading />}>
      <StorageInitializer>
    <VideoProjectProvider>
      <VideoEditor />
    </VideoProjectProvider>
        
        {/* Development-only storage monitoring */}
        {typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && <StorageStatus />}
      </StorageInitializer>
    </Suspense>
  );
} 