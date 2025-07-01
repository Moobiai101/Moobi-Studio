import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useVideoProject } from '../hooks/use-video-project';
import { 
  Layers, 
  Image as ImageIcon, 
  Video,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMediaInfo } from '../store/video-project-store';
import { createClient } from '@/lib/supabase/client';

interface OverlayControlsProps {
  selectedClip?: any;
  currentTime: number;
}

export function OverlayControls({ selectedClip, currentTime }: OverlayControlsProps) {
  const { project, addClip, addMediaAsset } = useVideoProject();
  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);
  const [selectedOverlayType, setSelectedOverlayType] = useState<'image' | 'video' | null>(null);
  const [pendingOverlay, setPendingOverlay] = useState<{name: string, url: string, duration: number} | null>(null);
  
  const supabase = createClient();

  // Get overlay track
  const overlayTrack = project.tracks.find(track => track.type === 'overlay');

  // Handle pending overlay when asset is added to project
  useEffect(() => {
    if (pendingOverlay && overlayTrack) {
      const addedAsset = project.mediaAssets.find(asset => {
        const mediaInfo = getMediaInfo(asset);
        return mediaInfo.name === pendingOverlay.name && mediaInfo.url === pendingOverlay.url;
      });
      
      if (addedAsset) {
        const mediaInfo = getMediaInfo(addedAsset);
        addClip({
          mediaId: addedAsset.id,
          trackId: overlayTrack.id,
          startTime: currentTime,
          endTime: currentTime + pendingOverlay.duration,
          trimStart: 0,
          trimEnd: mediaInfo.duration || pendingOverlay.duration,
          volume: 1,
          muted: false,
          effects: []
        });
        setPendingOverlay(null);
      }
    }
  }, [project.mediaAssets, pendingOverlay, overlayTrack, currentTime, addClip]);

  // Listen for the custom event from the timeline toolbar
  useEffect(() => {
    const handleOpenOverlayDialog = () => {
      setIsOverlayDialogOpen(true);
    };

    document.addEventListener('open-overlay-dialog', handleOpenOverlayDialog);
    
    return () => {
      document.removeEventListener('open-overlay-dialog', handleOpenOverlayDialog);
    };
  }, []);

  // Handle overlay file upload
  const handleOverlayUpload = async (file: File) => {
    try {
      // Get the authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("User not authenticated:", userError);
        alert("Please sign in to upload overlay files");
        return;
      }

      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('image/') ? 'image' : 'video' as 'image' | 'video';
      
      // Get actual duration for videos
      let duration: number | undefined = undefined;
      let metadata: any = {
        size: file.size,
        type: file.type,
      };

      if (type === 'video') {
        // Get actual video duration and metadata
        const video = document.createElement('video');
        video.src = url;
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', () => {
            duration = video.duration;
            metadata = {
              ...metadata,
              width: video.videoWidth,
              height: video.videoHeight,
            };
            resolve(void 0);
          });
        });
      } else if (type === 'image') {
        // Get image dimensions
        const img = document.createElement('img');
        img.src = url;
        await new Promise((resolve) => {
          img.addEventListener('load', () => {
            metadata = {
              ...metadata,
              width: img.naturalWidth,
              height: img.naturalHeight,
            };
            resolve(void 0);
          });
        });
        duration = 3; // Default 3 seconds for images
      }
      
      // Create media asset with correct UserAsset structure
      const mediaAsset = {
        user_id: user.id,
        title: file.name,
        file_name: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
        r2_object_key: url,
        duration_seconds: duration,
        dimensions: metadata.width && metadata.height ? {
          width: metadata.width,
          height: metadata.height
        } : undefined,
        video_metadata: type === 'video' ? {
          fps: 30 // Default FPS
        } : undefined,
        tags: [],
        source_studio: "video-studio",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to media assets first
      await addMediaAsset(mediaAsset);

      // Set up pending overlay to be added when the asset is available
      if (overlayTrack) {
        // Use actual duration for videos, default for images
        const overlayDuration = duration || 3;
        
        setPendingOverlay({
          name: file.name,
          url: url,
          duration: overlayDuration
        });
      }

      setIsOverlayDialogOpen(false);
      setSelectedOverlayType(null);
    } catch (error) {
      console.error('Error uploading overlay:', error);
      alert('Failed to upload overlay. Please try again.');
    }
  };

  // Removed overlay editing handlers - now handled by upper timeline controls

  return (
    <div className="flex items-center justify-between p-4 bg-zinc-900 border-t border-zinc-800">
      {/* Left side - Overlay Info */}
      <div className="flex items-center gap-2">
        {/* Hidden dialog trigger - activated by custom event */}
        <Dialog open={isOverlayDialogOpen} onOpenChange={setIsOverlayDialogOpen}>
          {/* Hidden trigger */}
          <DialogTrigger asChild>
            <span className="hidden"></span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Add Overlay
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Choose the type of overlay to add at {Math.floor(currentTime)}s
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-2",
                    selectedOverlayType === 'image' && "border-purple-400 bg-purple-500/10"
                  )}
                  onClick={() => setSelectedOverlayType('image')}
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-sm">Image</span>
                </Button>
                
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-2",
                    selectedOverlayType === 'video' && "border-purple-400 bg-purple-500/10"
                  )}
                  onClick={() => setSelectedOverlayType('video')}
                >
                  <Video className="w-6 h-6" />
                  <span className="text-sm">Video</span>
                </Button>
              </div>

              {selectedOverlayType && (
                <div className="space-y-3">
                  <label className="block">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-zinc-600 rounded-lg hover:border-purple-400 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept={selectedOverlayType === 'image' ? 'image/*' : 'video/*'}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleOverlayUpload(file);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                        <p className="text-sm text-zinc-400">
                          Click to upload {selectedOverlayType}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {selectedOverlayType === 'image' ? 'JPG, PNG, GIF' : 'MP4, MOV, AVI'}
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Overlay track info with icon */}
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Layers className="w-4 h-4 text-purple-400" />
          <span>{project.tracks.find(t => t.type === 'overlay')?.clips.length || 0} overlay{(project.tracks.find(t => t.type === 'overlay')?.clips.length || 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Removed overlay-specific editing controls - upper timeline controls handle all clip types */}
    </div>
  );
} 