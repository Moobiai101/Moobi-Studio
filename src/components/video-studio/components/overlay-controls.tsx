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
import { MediaAssetService } from '@/services/media-assets';
import { toast } from 'sonner';

interface OverlayControlsProps {
  selectedClip?: any;
  currentTime: number;
}

export function OverlayControls({ selectedClip, currentTime }: OverlayControlsProps) {
  const { tracks, mediaAssets, addClip, addMediaAsset } = useVideoProject();
  const [isOverlayDialogOpen, setIsOverlayDialogOpen] = useState(false);
  const [selectedOverlayType, setSelectedOverlayType] = useState<'image' | 'video' | null>(null);
  const [pendingOverlay, setPendingOverlay] = useState<{name: string, localAssetId: string, duration: number} | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Get overlay track (or create one if it doesn't exist)
  const overlayTrack = tracks.find(track => track.track_type === 'overlay');

  // Handle pending overlay when asset is added to project
  useEffect(() => {
    if (pendingOverlay && overlayTrack) {
      const addedAsset = mediaAssets.find(asset => {
        return asset.local_asset_id === pendingOverlay.localAssetId;
      });
      
      if (addedAsset) {
        // Use addClip method from store which handles the new schema
        addClip(
          overlayTrack.id, 
          addedAsset.id, 
          currentTime, 
          pendingOverlay.duration
        );
        setPendingOverlay(null);
        toast.success('Overlay added to timeline!');
      }
    }
  }, [mediaAssets, pendingOverlay, overlayTrack, currentTime, addClip]);

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
    if (isUploading) return;
    
    try {
      setIsUploading(true);
      toast.info(`Uploading ${file.name}...`);

      // Use MediaAssetService for proper local-first upload
      const result = await MediaAssetService.uploadMediaAsset(file, {
        onProgress: (progress) => {
          console.log(`Upload progress: ${Math.round(progress)}%`);
        },
        onStatusChange: (status) => {
          console.log(`Upload status: ${status}`);
        }
      });

      if (result.success && result.asset) {
        // Add the asset to the project store
        addMediaAsset(result.asset);

        // Set up pending overlay to be added when the asset is available
        if (overlayTrack && result.asset.local_asset_id) {
          // Default overlay duration
          const overlayDuration = result.asset.duration_seconds || 3;
          
          setPendingOverlay({
            name: file.name,
            localAssetId: result.asset.local_asset_id,
            duration: overlayDuration
          });
        }

        setIsOverlayDialogOpen(false);
        setSelectedOverlayType(null);
        toast.success(`${file.name} uploaded successfully!`);
      } else {
        toast.error(`Failed to upload ${file.name}: ${result.error}`);
      }
    } catch (error) {
      console.error('Error uploading overlay:', error);
      toast.error('Failed to upload overlay. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Get overlay count safely
  const overlayCount = overlayTrack?.clips?.length || 0;

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
                  disabled={isUploading}
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
                  disabled={isUploading}
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
                          if (file && !isUploading) {
                            handleOverlayUpload(file);
                          }
                        }}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <div className="text-center">
                        {isUploading ? (
                          <>
                            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-sm text-purple-400">Uploading...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                            <p className="text-sm text-zinc-400">
                              Click to upload {selectedOverlayType}
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {selectedOverlayType === 'image' ? 'JPG, PNG, GIF' : 'MP4, MOV, AVI'}
                            </p>
                          </>
                        )}
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
          <span>
            {overlayCount} overlay{overlayCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Removed overlay-specific editing controls - upper timeline controls handle all clip types */}
    </div>
  );
} 