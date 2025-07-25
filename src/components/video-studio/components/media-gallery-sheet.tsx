"use client";

import { useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Film, 
  Music, 
  Image as ImageIcon,
  Clock,
  Plus
} from "lucide-react";
import { formatTime } from "../lib/utils";
import { useVideoProject } from "../hooks/use-video-project";
import { getMediaInfo } from "../store/video-project-store";

interface MediaGallerySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMediaSelect?: (asset: any) => void;
}

export function MediaGallerySheet({ open, onOpenChange, onMediaSelect }: MediaGallerySheetProps) {
  const { project, addClip, selectedTrackId } = useVideoProject();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAssets = project.mediaAssets.filter(asset =>
    getMediaInfo(asset).name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToTimeline = (asset: any) => {
    if (!selectedTrackId) {
      console.warn("No track selected");
      return;
    }

    const mediaInfo = getMediaInfo(asset);
    const duration = mediaInfo.duration || 5; // Default 5 seconds

    // Find the end of the last clip on the selected track
    const track = project.tracks.find(t => t.id === selectedTrackId);
    if (!track) return;

    const lastClip = track.clips.sort((a, b) => b.endTime - a.endTime)[0];
    const startTime = lastClip ? lastClip.endTime : 0;

    addClip({
      mediaId: asset.id,
      trackId: selectedTrackId,
      startTime,
      endTime: startTime + duration,
      trimStart: 0,
      trimEnd: duration,
    });

    if (onMediaSelect) {
      onMediaSelect(asset);
    }

    onOpenChange(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <Film className="w-4 h-4" />;
      case "audio": return <Music className="w-4 h-4" />;
      case "image": return <ImageIcon className="w-4 h-4" />;
      default: return <ImageIcon className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "video": return "text-blue-400";
      case "audio": return "text-green-400";
      case "image": return "text-purple-400";
      default: return "text-gray-400";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] bg-zinc-950 border-zinc-800">
        <SheetHeader>
          <SheetTitle className="text-white">Media Library</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
            />
          </div>

          {/* Media Grid */}
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="grid grid-cols-2 gap-3">
              {filteredAssets.map((asset) => {
                const mediaInfo = getMediaInfo(asset);
                
                return (
                  <div
                    key={asset.id}
                    className="group relative bg-zinc-900 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                    onClick={() => handleAddToTimeline(asset)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-zinc-800 flex items-center justify-center">
                      {mediaInfo.thumbnailUrl ? (
                        <img
                          src={mediaInfo.thumbnailUrl}
                          alt={mediaInfo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={getTypeColor(mediaInfo.type)}>
                          {getIcon(mediaInfo.type)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      <p className="text-xs text-white truncate">{mediaInfo.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`${getTypeColor(mediaInfo.type)}`}>
                          {getIcon(mediaInfo.type)}
                        </span>
                        {mediaInfo.duration && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(mediaInfo.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add Button Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToTimeline(asset);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to Timeline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredAssets.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                {searchQuery ? "No media found matching your search." : "No media in library."}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
} 