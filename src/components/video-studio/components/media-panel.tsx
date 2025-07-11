"use client";

import { useState } from "react";
import { useVideoProject } from "../hooks/use-video-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  Plus,
  Film,
  Music,
  Image as ImageIcon,
  Upload,
  Search,
  Grid3X3,
  List,
  PlayCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { formatTime } from "../lib/utils";
import { getMediaInfo } from "../store/video-project-store";
import { MediaAssetService } from "@/services/media-assets";
import { toast } from "sonner";
import { indexedDBManager } from "@/lib/storage/indexed-db-manager";
import { useResolvedMediaUrl } from "@/lib/video/media-url-resolver";

export function MediaPanel() {
  const { mediaAssets, addMediaAsset } = useVideoProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Filter media assets based on search query
  const filteredAssets = mediaAssets.filter((asset: any) => {
    const mediaInfo = getMediaInfo(asset);
    const name = mediaInfo?.name ?? '';
    const query = searchQuery ?? '';
    // Add null safety checks
    return name && typeof name === 'string' 
      ? name.toLowerCase().includes(query.toLowerCase())
      : false;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) {
      try {
        toast.info(`Uploading ${file.name}...`);

        const result = await MediaAssetService.uploadMediaAsset(file, {
          onProgress: (progress) => {
            // You could update UI progress here if needed
            console.log(`Upload progress for ${file.name}: ${Math.round(progress)}%`);
          },
          onStatusChange: (status) => {
            console.log(`Upload status for ${file.name}: ${status}`);
          }
        });

        if (result.success && result.asset) {
          // Add the asset to the project store
          addMediaAsset(result.asset);
          successCount++;
          toast.success(`${file.name} uploaded successfully!`);
        } else {
          errorCount++;
          toast.error(`Failed to upload ${file.name}: ${result.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error uploading ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    // Show summary
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file${successCount !== 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to upload ${errorCount} file${errorCount !== 1 ? 's' : ''}`);
    }

    setIsUploading(false);
    // Clear the input so the same file can be uploaded again
    e.target.value = "";
  };

  const handleDragStart = (e: React.DragEvent, asset: any) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ assetId: asset.id }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const MediaItem = ({ asset }: { asset: any }) => {
    const mediaInfo = getMediaInfo(asset);
    const { url: resolvedUrl, isLoading: isLoadingUrl, error: urlError } = useResolvedMediaUrl(mediaInfo.url);
    
    const getIcon = () => {
      switch (mediaInfo.type) {
        case "video": return <Film className="w-4 h-4" />;
        case "audio": return <Music className="w-4 h-4" />;
        case "image": return <ImageIcon className="w-4 h-4" />;
        default: return <ImageIcon className="w-4 h-4" />;
      }
    };

    const getTypeColor = () => {
      switch (mediaInfo.type) {
        case "video": return "text-blue-400";
        case "audio": return "text-green-400";
        case "image": return "text-purple-400";
        default: return "text-gray-400";
      }
    };

    // Handle URL resolution error
    if (urlError) {
      console.warn(`⚠️ Media item URL resolution failed for ${asset.id}:`, urlError.message);
    }

    if (viewMode === "grid") {
      return (
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, asset)}
          className="group relative bg-zinc-900 rounded-lg p-2 cursor-pointer hover:bg-zinc-800 transition-colors"
        >
          {/* Thumbnail */}
          <div className="aspect-video bg-zinc-800 rounded-md mb-2 flex items-center justify-center overflow-hidden">
            {mediaInfo.type === "image" ? (
              isLoadingUrl ? (
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
              ) : urlError ? (
                <div className="flex flex-col items-center gap-1 text-red-400">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-xs">Error</span>
                </div>
              ) : (
                <img 
                  src={resolvedUrl} 
                  alt={mediaInfo.name}
                  className="w-full h-full object-cover"
                  onError={() => console.warn(`⚠️ Image load failed: ${asset.id}`)}
                />
              )
            ) : (
              <div className={cn("flex flex-col items-center gap-1", urlError ? "text-red-400" : getTypeColor())}>
                {getIcon()}
                <span className="text-xs opacity-75">
                  {urlError ? "ERROR" : mediaInfo.type.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Duration overlay */}
          {mediaInfo.duration && mediaInfo.type !== "image" && (
            <div className="absolute top-3 right-3 bg-black/70 px-1 py-0.5 rounded text-xs text-white">
              {formatTime(mediaInfo.duration)}
            </div>
          )}

          {/* Type indicator for images or error indicator */}
          {mediaInfo.type === "image" && !urlError && (
            <div className="absolute top-3 right-3 bg-purple-600/80 px-1 py-0.5 rounded text-xs text-white">
              IMG
            </div>
          )}
          
          {urlError && (
            <div className="absolute top-3 right-3 bg-red-600/80 px-1 py-0.5 rounded text-xs text-white">
              ERR
            </div>
          )}

          {/* Asset info */}
          <div className="space-y-1">
            <p className="text-xs text-white truncate font-medium">{mediaInfo.name}</p>
            <div className="flex items-center justify-between">
              <p className={cn("text-xs capitalize", urlError ? "text-red-400" : getTypeColor())}>
                {urlError ? "Error" : mediaInfo.type}
              </p>
              {mediaInfo.type === "image" && !urlError && (
                <p className="text-xs text-zinc-400">{formatTime(mediaInfo.duration || 5)}</p>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, asset)}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors"
        >
          <div className={cn("shrink-0", urlError ? "text-red-400" : getTypeColor())}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate font-medium">{mediaInfo.name}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className={cn("capitalize", urlError ? "text-red-400" : "text-zinc-400")}>
                {urlError ? "Error" : mediaInfo.type}
              </span>
              {(mediaInfo.duration || mediaInfo.type === "image") && !urlError && (
                <>
                  <span>•</span>
                  <span>{formatTime(mediaInfo.duration || 5)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className={cn(
      "bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out relative",
      isCollapsed ? "w-12" : "w-80"
    )}>
      {/* Collapse Toggle Button */}
      <div className="absolute top-4 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-zinc-400 hover:text-white h-8 w-8 p-0 hover:bg-zinc-800"
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </Button>
      </div>

      {/* Collapsed State - Just the toggle strip */}
      {isCollapsed && (
        <div className="flex flex-col items-center justify-center h-full py-4">
          <div className="writing-vertical text-xs text-zinc-500 font-medium transform -rotate-90 whitespace-nowrap">
            Media Panel
          </div>
        </div>
      )}

      {/* Expanded State - Full Panel */}
      {!isCollapsed && (
        <>
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 pr-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Media Assets</h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                  className="text-zinc-400 hover:text-white h-7 w-7 p-0"
                >
                  {viewMode === "grid" ? <List className="w-3 h-3" /> : <Grid3X3 className="w-3 h-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white h-7 px-2 text-xs"
                  onClick={() => document.getElementById('media-file-input')?.click()}
                  disabled={isUploading}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {isUploading ? "Uploading..." : "Add"}
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-zinc-800 border-zinc-700 text-white placeholder-zinc-400"
              />
            </div>
          </div>

          {/* Media Grid/List */}
          <ScrollArea className="flex-1 p-4">
            {filteredAssets.length === 0 ? (
              <div className="text-center py-8">
                {searchQuery ? (
                  <div>
                    <Search className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">No media found</p>
                    <p className="text-xs text-zinc-600 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">No media assets</p>
                    <p className="text-xs text-zinc-600 mt-1">Upload files to get started</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      onClick={() => document.getElementById('media-file-input')?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Upload Media
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className={cn(
                "gap-3",
                viewMode === "grid" ? "grid grid-cols-2" : "space-y-1"
              )}>
                {filteredAssets.map((asset: any) => (
                  <MediaItem key={asset.id} asset={asset} />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Stats */}
          <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500">
            {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
            {searchQuery && ` (filtered from ${mediaAssets.length})`}
          </div>

          {/* Hidden file input */}
          <input
            id="media-file-input"
            type="file"
            multiple
            accept="video/*,audio/*,image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </>
      )}
    </div>
  );
} 