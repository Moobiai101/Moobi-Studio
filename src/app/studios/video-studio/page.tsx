"use client";

import { VideoProjectProvider } from "@/components/video-studio/providers/video-project-provider";
import { VideoEditor } from "@/components/video-studio/components/video-editor";
import { StorageInitializer, StorageStatus } from "@/components/video-studio/storage-init";

export default function VideoStudioPage() {
  return (
    <StorageInitializer>
      <VideoProjectProvider>
        <VideoEditor />
      </VideoProjectProvider>
      
      {/* Development-only storage monitoring */}
      {process.env.NODE_ENV === 'development' && <StorageStatus />}
    </StorageInitializer>
  );
} 