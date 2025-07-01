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

interface OverlayControlsProps {
  selectedClip?: any;
  currentTime: number;
}

export function OverlayControls({ selectedClip, currentTime }: OverlayControlsProps) {
  const { project, addClip, addMediaAsset } = useVideoProject();
  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);
  const [selectedOverlayType, setSelectedOverlayType] = useState<'image' | 'video' | null>(null);
  const [pendingOverlay, setPendingOverlay] = useState<{name: string, url: string, duration: number} | null>(null);

  // Get overlay track
  const overlayTrack = project.tracks.find(track => track.type === 'overlay');

  // Handle pending overlay when asset is added to project
  useEffect(() => {
    if (pendingOverlay && overlayTrack) {
      const addedAsset = project.mediaAssets.find(asset => 
        asset.name === pendingOverlay.name && asset.url === pendingOverlay.url
      );
      
      if (addedAsset) {
        addClip({
          mediaId: addedAsset.id,
          trackId: overlayTrack.id,
          startTime: currentTime,
          endTime: currentTime + pendingOverlay.duration,
          trimStart: 0,
          trimEnd: addedAsset.duration || pendingOverlay.duration,
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
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('image/') ? 'image' : 'video' as 'image' | 'video';
      
      // Get actual duration for videos
      let duration: number | undefined = undefined;
      if (type === 'video') {
        // Get actual video duration
        const video = document.createElement('video');
        video.src = url;
        await new Promise((resolve) => {
          video.addEventListener('loadedmetadata', () => {
            duration = video.duration;
            resolve(void 0);
          });
        });
      }
      
      // Create media asset with proper duration
      const mediaAsset = {
        type,
        url,
        name: file.name,
        duration, // Will be actual duration for video, undefined for image
        thumbnail: type === 'image' ? url : undefined,
        metadata: {
          size: file.size,
        }
      };

      // Add to media assets first
      addMediaAsset(mediaAsset);

      // Set up pending overlay to be added when the asset is available
      if (overlayTrack) {
        // Use actual duration for videos, default for images
        const overlayDuration = mediaAsset.type === 'video' 
          ? (duration || 5) // Use actual duration or fallback to 5s
          : 3; // 3s default for images
        
        setPendingOverlay({
          name: mediaAsset.name,
          url: mediaAsset.url,
          duration: overlayDuration
        });
      }

      setIsOverlayDialogOpen(false);
      setSelectedOverlayType(null);
    } catch (error) {
      console.error('Error uploading overlay:', error);
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