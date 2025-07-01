"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Download, 
  Settings, 
  Video, 
  FileVideo,
  Loader2
} from "lucide-react";
import { useVideoProject } from "../hooks/use-video-project";

interface VideoExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoExportDialog({ open, onOpenChange }: VideoExportDialogProps) {
  const { project } = useVideoProject();
  
  const [exportSettings, setExportSettings] = useState({
    format: "mp4",
    quality: "high",
    resolution: `${project.resolution.width}x${project.resolution.height}`,
    fps: project.fps,
    bitrate: "auto",
    codec: "h264",
    audioCodec: "aac",
    audioBitrate: "128",
    includeAudio: true,
    filename: project.name.replace(/\s+/g, "_").toLowerCase(),
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");

  const formatOptions = [
    { value: "mp4", label: "MP4", description: "Most compatible format" },
    { value: "webm", label: "WebM", description: "Web optimized" },
    { value: "mov", label: "MOV", description: "High quality" },
    { value: "avi", label: "AVI", description: "Uncompressed" },
  ];

  const qualityOptions = [
    { value: "low", label: "Low (720p)", bitrate: "1000k" },
    { value: "medium", label: "Medium (1080p)", bitrate: "2500k" },
    { value: "high", label: "High (1080p)", bitrate: "5000k" },
    { value: "ultra", label: "Ultra (4K)", bitrate: "10000k" },
  ];

  const resolutionOptions = [
    { value: "3840x2160", label: "4K (3840×2160)" },
    { value: "1920x1080", label: "Full HD (1920×1080)" },
    { value: "1280x720", label: "HD (1280×720)" },
    { value: "854x480", label: "SD (854×480)" },
    { value: "640x360", label: "Low (640×360)" },
  ];

  const codecOptions = [
    { value: "h264", label: "H.264", description: "Most compatible" },
    { value: "h265", label: "H.265/HEVC", description: "Better compression" },
    { value: "vp9", label: "VP9", description: "Web optimized" },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus("Preparing export...");

    try {
      // Simulate export progress
      const steps = [
        "Analyzing timeline...",
        "Processing video tracks...",
        "Processing audio tracks...",
        "Applying effects...",
        "Encoding video...",
        "Finalizing export...",
      ];

      for (let i = 0; i < steps.length; i++) {
        setExportStatus(steps[i]);
        setExportProgress((i + 1) / steps.length * 100);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setExportStatus("Export completed!");
      
      // TODO: Implement actual export using Remotion
      // This would involve:
      // 1. Creating a Remotion bundle
      // 2. Rendering the composition
      // 3. Downloading the result
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStatus("");
        onOpenChange(false);
      }, 1000);

    } catch (error) {
      console.error("Export failed:", error);
      setExportStatus("Export failed!");
      setIsExporting(false);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setExportSettings(prev => ({ ...prev, [key]: value }));
  };

  const estimatedFileSize = () => {
    const quality = qualityOptions.find(q => q.value === exportSettings.quality);
    if (!quality) return "Unknown";
    
    const bitrate = parseInt(quality.bitrate.replace("k", ""));
    const sizeInMB = (bitrate * project.duration) / 8 / 1000;
    
    if (sizeInMB > 1000) {
      return `~${(sizeInMB / 1000).toFixed(1)} GB`;
    }
    return `~${sizeInMB.toFixed(0)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Video
          </DialogTitle>
        </DialogHeader>

        {isExporting ? (
          <div className="space-y-4 py-6">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Exporting Video</h3>
              <p className="text-sm text-muted-foreground mb-4">{exportStatus}</p>
            </div>
            
            <Progress value={exportProgress} className="w-full" />
            
            <div className="text-center text-sm text-muted-foreground">
              {exportProgress.toFixed(0)}% complete
            </div>
          </div>
        ) : (
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={exportSettings.format} onValueChange={(value) => updateSetting("format", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        <div>
                          <div className="font-medium">{format.label}</div>
                          <div className="text-xs text-muted-foreground">{format.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quality Selection */}
              <div className="space-y-2">
                <Label>Quality</Label>
                <Select value={exportSettings.quality} onValueChange={(value) => updateSetting("quality", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {qualityOptions.map((quality) => (
                      <SelectItem key={quality.value} value={quality.value}>
                        <div>
                          <div className="font-medium">{quality.label}</div>
                          <div className="text-xs text-muted-foreground">Bitrate: {quality.bitrate}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <Label>Resolution</Label>
                <Select value={exportSettings.resolution} onValueChange={(value) => updateSetting("resolution", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resolutionOptions.map((resolution) => (
                      <SelectItem key={resolution.value} value={resolution.value}>
                        {resolution.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filename */}
              <div className="space-y-2">
                <Label>Filename</Label>
                <Input
                  value={exportSettings.filename}
                  onChange={(e) => updateSetting("filename", e.target.value)}
                  placeholder="Enter filename"
                />
              </div>

              {/* Include Audio */}
              <div className="flex items-center justify-between">
                <Label>Include Audio</Label>
                <Switch
                  checked={exportSettings.includeAudio}
                  onCheckedChange={(checked: boolean) => updateSetting("includeAudio", checked)}
                />
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              {/* Video Codec */}
              <div className="space-y-2">
                <Label>Video Codec</Label>
                <Select value={exportSettings.codec} onValueChange={(value) => updateSetting("codec", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {codecOptions.map((codec) => (
                      <SelectItem key={codec.value} value={codec.value}>
                        <div>
                          <div className="font-medium">{codec.label}</div>
                          <div className="text-xs text-muted-foreground">{codec.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frame Rate */}
              <div className="space-y-2">
                <Label>Frame Rate</Label>
                <Select value={exportSettings.fps.toString()} onValueChange={(value) => updateSetting("fps", parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 fps</SelectItem>
                    <SelectItem value="25">25 fps</SelectItem>
                    <SelectItem value="30">30 fps</SelectItem>
                    <SelectItem value="60">60 fps</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Video Bitrate */}
              <div className="space-y-2">
                <Label>Video Bitrate</Label>
                <Select value={exportSettings.bitrate} onValueChange={(value) => updateSetting("bitrate", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="1000k">1 Mbps</SelectItem>
                    <SelectItem value="2500k">2.5 Mbps</SelectItem>
                    <SelectItem value="5000k">5 Mbps</SelectItem>
                    <SelectItem value="10000k">10 Mbps</SelectItem>
                    <SelectItem value="20000k">20 Mbps</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {exportSettings.includeAudio && (
                <>
                  {/* Audio Codec */}
                  <div className="space-y-2">
                    <Label>Audio Codec</Label>
                    <Select value={exportSettings.audioCodec} onValueChange={(value) => updateSetting("audioCodec", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aac">AAC</SelectItem>
                        <SelectItem value="mp3">MP3</SelectItem>
                        <SelectItem value="opus">Opus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Audio Bitrate */}
                  <div className="space-y-2">
                    <Label>Audio Bitrate</Label>
                    <Select value={exportSettings.audioBitrate} onValueChange={(value) => updateSetting("audioBitrate", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="96">96 kbps</SelectItem>
                        <SelectItem value="128">128 kbps</SelectItem>
                        <SelectItem value="192">192 kbps</SelectItem>
                        <SelectItem value="256">256 kbps</SelectItem>
                        <SelectItem value="320">320 kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}

        {!isExporting && (
          <>
            {/* Export Info */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Duration:</span>
                <span>{Math.floor(project.duration / 60)}:{(project.duration % 60).toFixed(0).padStart(2, '0')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Estimated Size:</span>
                <span>{estimatedFileSize()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Output:</span>
                <span>{exportSettings.filename}.{exportSettings.format}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Video
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
} 