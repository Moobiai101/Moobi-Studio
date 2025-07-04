"use client";

import { VideoProjectProvider } from "@/components/video-studio/providers/video-project-provider";
import { VideoEditor } from "@/components/video-studio/components/video-editor";

export default function VideoStudioPage() {
  return (
    <VideoProjectProvider>
      <VideoEditor />
    </VideoProjectProvider>
  );
} 