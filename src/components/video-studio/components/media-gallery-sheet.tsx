"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  Download, 
  Copy, 
  Trash2, 
  Edit,
  Info,
  Settings,
  Plus,
  Volume2,
  VolumeX
} from "lucide-react";
import { useVideoProject } from "../hooks/use-video-project";
import { formatTime, formatFileSize } from "../lib/utils";

interface MediaGallerySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMediaId: string;
}

export function MediaGallerySheet({ open, onOpenChange, selectedMediaId }: MediaGallerySheetProps) {
  const { 
    project, 
    addClip, 
    removeMediaAsset, 
    updateClip 
  } = useVideoProject();

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  const selectedAsset = project.mediaAssets.find((asset: any) => asset.id === selectedMediaId);

  if (!selectedAsset) {
    return null;
  }

  // Find clips using this asset
  const relatedClips = project.tracks
    .flatMap((track: any) => track.clips)
    .filter((clip: any) => clip.mediaId === selectedMediaId);

  const handleAddToTimeline = () => {
    // Find appropriate track
    const targetTrack = project.tracks.find((track: any) => 
      (selectedAsset.type === "video" || selectedAsset.type === "image") 
        ? track.type === "video" 
        : track.type === "audio"
    );

    if (targetTrack) {
      // Find the end time of the last clip in the track
      const lastClip = targetTrack.clips.reduce((latest: number, clip: any) => 
        clip.endTime > latest ? clip.endTime : latest, 0
      );

      addClip({
        mediaId: selectedAsset.id,
        trackId: targetTrack.id,
        startTime: lastClip,
        endTime: lastClip + (selectedAsset.duration || 5),
        trimStart: 0,
        trimEnd: selectedAsset.duration || 5,
        volume: 1,
        muted: false,
        effects: [],
      });
    }
  };

  const handleDeleteAsset = () => {
    if (confirm("Are you sure you want to delete this media asset? This will also remove all clips using this asset.")) {
      removeMediaAsset(selectedAsset.id);
      onOpenChange(false);
    }
  };

  const handleRename = () => {
    if (editingName) {
      // TODO: Implement asset renaming
      console.log("Renaming asset to:", newName);
      setEditingName(false);
    } else {
      setNewName(selectedAsset.name);
      setEditingName(true);
    }
  };

  const handleDownload = () => {
    // Create download link
    const link = document.createElement('a');
    link.href = selectedAsset.url;
    link.download = selectedAsset.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDuplicate = () => {
    // TODO: Implement asset duplication
    console.log("Duplicating asset:", selectedAsset.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Media Details
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Media Preview */}
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              {selectedAsset.type === "video" ? (
                <video
                  src={selectedAsset.url}
                  className="w-full h-full object-contain"
                  controls={false}
                  muted={isMuted}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  ref={(el) => {
                    if (el) el.volume = volume;
                  }}
                />
              ) : selectedAsset.type === "image" ? (
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Volume2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Audio File</p>
                    <p className="text-xs opacity-75">{selectedAsset.name}</p>
                  </div>
                </div>
              )}

              {/* Media Controls */}
              {(selectedAsset.type === "video" || selectedAsset.type === "audio") && (
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="bg-black/50 hover:bg-black/70"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>

                  {selectedAsset.type === "video" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsMuted(!isMuted)}
                        className="bg-black/50 hover:bg-black/70"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="flex-1"
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button onClick={handleAddToTimeline} className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                Add to Timeline
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={handleDeleteAsset}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Detailed Information */}
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Information</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Name</Label>
                    {editingName ? (
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={handleRename}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm flex-1">{selectedAsset.name}</p>
                        <Button size="sm" variant="ghost" onClick={handleRename}>
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Type</Label>
                    <p className="text-sm text-muted-foreground capitalize">{selectedAsset.type}</p>
                  </div>

                  {selectedAsset.duration && (
                    <div>
                      <Label className="text-sm font-medium">Duration</Label>
                      <p className="text-sm text-muted-foreground">{formatTime(selectedAsset.duration)}</p>
                    </div>
                  )}

                  {selectedAsset.metadata?.size && (
                    <div>
                      <Label className="text-sm font-medium">File Size</Label>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedAsset.metadata.size)}</p>
                    </div>
                  )}

                  {selectedAsset.metadata?.width && selectedAsset.metadata?.height && (
                    <div>
                      <Label className="text-sm font-medium">Resolution</Label>
                      <p className="text-sm text-muted-foreground">
                        {selectedAsset.metadata.width} × {selectedAsset.metadata.height}
                      </p>
                    </div>
                  )}

                  {selectedAsset.metadata?.fps && (
                    <div>
                      <Label className="text-sm font-medium">Frame Rate</Label>
                      <p className="text-sm text-muted-foreground">{selectedAsset.metadata.fps} fps</p>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium">Added</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedAsset.createdAt.toLocaleDateString()} at {selectedAsset.createdAt.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="usage" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Timeline Usage</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    This asset is used in {relatedClips.length} clip(s)
                  </p>
                </div>

                {relatedClips.length > 0 ? (
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {relatedClips.map((clip: any, index: number) => {
                        const track = project.tracks.find((t: any) => t.id === clip.trackId);
                        return (
                          <div key={clip.id} className="bg-muted rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Clip {index + 1}</p>
                                <p className="text-xs text-muted-foreground">
                                  Track: {track?.name || "Unknown"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Duration: {formatTime(clip.endTime - clip.startTime)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">This asset is not used in the timeline</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAddToTimeline}
                      className="mt-2"
                    >
                      Add to Timeline
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Asset Settings</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Configure how this asset behaves in the timeline
                  </p>
                </div>

                {/* TODO: Add asset-specific settings */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Default Volume</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      defaultValue="1"
                      className="w-full mt-1"
                    />
                  </div>

                  {selectedAsset.type === "image" && (
                    <div>
                      <Label className="text-sm">Default Duration (seconds)</Label>
                      <Input
                        type="number"
                        defaultValue="5"
                        min="0.1"
                        step="0.1"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
} 