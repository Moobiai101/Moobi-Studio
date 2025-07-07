"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft,
  ChevronRight,
  Sparkles, 
  Video, 
  Image as ImageIcon, 
  Search,
  Wand2,
  Upload,
  Download,
  Play,
  Plus,
  Settings,
  Clock,
  Zap,
  Camera,
  Film,
  Palette,
  Music,
  FileImage,
  ExternalLink,
  Heart,
  Star
} from "lucide-react";
import { useVideoProject } from "../hooks/use-video-project";
import { AIGenerationService } from "@/services/ai-generation-service";
import { toast } from "sonner";

interface AIPromptPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function AIPromptPanel({ isCollapsed, onToggleCollapse }: AIPromptPanelProps) {
  const { 
    project,
    addMediaAsset
  } = useVideoProject();

  const [activeTab, setActiveTab] = useState("text-to-video");
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  
  // Form state
  const [textPrompt, setTextPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("runway-gen3");
  const [duration, setDuration] = useState([5]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("standard");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState("shutterstock");
  
  // Mock search results - TODO: Integrate with real search APIs
  const mockSearchResults = [
    {
      id: "1",
      type: "video" as const,
      title: "Mountain Landscape",
      thumbnail: "/api/placeholder/200/120",
      duration: "0:15",
      provider: "Shutterstock",
      license: "Royalty-free"
    },
    {
      id: "2", 
      type: "image" as const,
      title: "Ocean Sunset",
      thumbnail: "/api/placeholder/200/120",
      provider: "Unsplash",
      license: "Free"
    }
  ];

  const handleGenerate = async () => {
    if (!textPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (!project) {
      toast.error("No project loaded");
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStatus("Starting generation...");

      // Get selected generation type
      const generationType = activeTab as 'text_to_video' | 'image_to_video' | 'audio_generation';

      // Prepare generation parameters
      const parameters = {
        duration: duration[0],
        aspectRatio,
        quality,
        resolution: aspectRatio === "16:9" ? { width: 1920, height: 1080 } : 
                   aspectRatio === "9:16" ? { width: 1080, height: 1920 } :
                   { width: 1080, height: 1080 }
      };

      // Start AI generation
      const generation = await AIGenerationService.startGeneration(
        generationType,
        textPrompt,
        {
          projectId: project.id,
          aiModel: selectedModel,
          negativePrompt: negativePrompt || undefined,
          parameters
        }
      );

      if (!generation) {
        throw new Error("Failed to start generation");
      }

      setCurrentGenerationId(generation.id);
      toast.success("Generation started!");

      // Simulate progress updates (in production, this would be real-time updates)
      const progressInterval = setInterval(async () => {
        if (!currentGenerationId) return;

        try {
          const status = await AIGenerationService.getGenerationStatus(generation.id);
          if (!status) return;

          setGenerationProgress(status.progress);
          setGenerationStatus(status.status === 'processing' ? 
            `Generating... ${status.progress}%` : 
            status.status
          );

          if (status.status === 'completed') {
            clearInterval(progressInterval);
            setIsGenerating(false);
            setCurrentGenerationId(null);
            
            if (status.generated_asset_id) {
              // The asset should already be in the database, so we need to refresh media assets
              // In practice, the completion webhook would handle this
              toast.success("Generation completed! Asset added to media library.");
            }
          } else if (status.status === 'failed') {
            clearInterval(progressInterval);
            setIsGenerating(false);
            setCurrentGenerationId(null);
            toast.error("Generation failed. Please try again.");
          }
        } catch (error) {
          console.error("Error checking generation status:", error);
        }
      }, 2000);

      // Cleanup interval after 10 minutes
      setTimeout(() => {
        clearInterval(progressInterval);
        if (isGenerating) {
          setIsGenerating(false);
          setCurrentGenerationId(null);
          toast.error("Generation timed out");
        }
      }, 600000);

    } catch (error) {
      console.error("Generation error:", error);
      setIsGenerating(false);
      setCurrentGenerationId(null);
      toast.error(error instanceof Error ? error.message : "Generation failed");
    }
  };

  const handleCancelGeneration = async () => {
    if (currentGenerationId) {
      try {
        await AIGenerationService.cancelGeneration(currentGenerationId);
        setIsGenerating(false);
        setCurrentGenerationId(null);
        toast.info("Generation cancelled");
      } catch (error) {
        console.error("Error cancelling generation:", error);
        toast.error("Failed to cancel generation");
      }
    }
  };

  const getAvailableModels = () => {
    const generationType = activeTab.replace('-', '_') as 'text_to_video' | 'image_to_video' | 'audio_generation';
    return AIGenerationService.getAvailableModels(generationType).map(model => ({
      id: model,
      name: model.charAt(0).toUpperCase() + model.slice(1).replace('-', ' '),
      description: AIGenerationService.getModelCapabilities(model).features.join(', ')
    }));
  };

  const models = getAvailableModels();

  if (isCollapsed) {
    return (
      <div className="w-12 bg-zinc-900 border-l border-zinc-800 flex flex-col items-center py-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="w-8 h-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="AI Generate"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Media Search"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 lg:w-72 xl:w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
      {/* Panel Header */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-3 lg:px-4 shrink-0">
        <h2 className="text-xs lg:text-sm font-medium text-white">AI Studio</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="w-6 h-6 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b border-zinc-800 px-3 lg:px-4 py-2 shrink-0">
            <TabsList className="grid w-full grid-cols-2 bg-zinc-800 h-7 lg:h-8">
              <TabsTrigger 
                value="text-to-video" 
                className="text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white px-1 lg:px-2"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Generate</span>
                <span className="sm:hidden">Gen</span>
              </TabsTrigger>
              <TabsTrigger 
                value="media-search"
                className="text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white px-1 lg:px-2"
              >
                <Search className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Search</span>
                <span className="sm:hidden">Find</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            <TabsContent value="text-to-video" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-3 lg:p-4 space-y-3 lg:space-y-4">
                  {/* Generation Type Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Generation Type</Label>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-zinc-800 h-8">
                        <TabsTrigger value="text-to-video" className="text-xs px-2">
                          <Video className="w-3 h-3 mr-1" />
                          Text
                        </TabsTrigger>
                        <TabsTrigger value="image-to-video" className="text-xs px-2">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          Image
                        </TabsTrigger>
                        <TabsTrigger value="audio-generation" className="text-xs px-2">
                          <Music className="w-3 h-3 mr-1" />
                          Audio
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Prompt Input */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Prompt</Label>
                    <Textarea
                      value={textPrompt}
                      onChange={(e) => setTextPrompt(e.target.value)}
                      placeholder="Describe the content you want to generate..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none h-20 text-sm"
                      disabled={isGenerating}
                    />
                    <div className="text-xs text-zinc-500 text-right">
                      {textPrompt.length}/500
                    </div>
                  </div>

                  {/* Negative Prompt */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Negative Prompt (Optional)</Label>
                    <Textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="What you don't want to see..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none h-16 text-sm"
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">AI Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isGenerating}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id} className="text-white">
                            <div className="flex flex-col">
                              <span className="text-sm">{model.name}</span>
                              <span className="text-xs text-zinc-400">{model.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration Setting */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-zinc-300">Duration</Label>
                      <span className="text-xs text-zinc-400">{duration[0]}s</span>
                    </div>
                    <Slider
                      value={duration}
                      onValueChange={setDuration}
                      max={AIGenerationService.getModelCapabilities(selectedModel).maxDuration}
                      min={1}
                      step={1}
                      className="w-full"
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Aspect Ratio</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {["16:9", "9:16", "1:1"].map((ratio) => (
                        <Button
                          key={ratio}
                          variant={aspectRatio === ratio ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAspectRatio(ratio)}
                          disabled={isGenerating}
                          className={cn(
                            "h-8 text-xs",
                            aspectRatio === ratio 
                              ? "bg-blue-600 text-white" 
                              : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                          )}
                        >
                          {ratio}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Quality Setting */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Quality</Label>
                    <Select value={quality} onValueChange={setQuality} disabled={isGenerating}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="draft" className="text-white">Draft (Fast)</SelectItem>
                        <SelectItem value="standard" className="text-white">Standard</SelectItem>
                        <SelectItem value="high" className="text-white">High Quality</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Generate Button */}
                  <div className="space-y-2">
                    {!isGenerating ? (
                      <Button
                        onClick={handleGenerate}
                        disabled={!textPrompt.trim()}
                        className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate {activeTab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          onClick={handleCancelGeneration}
                          variant="outline"
                          className="w-full border-red-600 text-red-400 hover:bg-red-600/10"
                        >
                          Cancel Generation
                        </Button>
                        <div className="text-xs text-zinc-400 text-center">
                          {generationStatus}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Generation Progress */}
                  {isGenerating && (
                    <div className="space-y-2">
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${generationProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-400 text-center">
                        {generationProgress}% complete
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="media-search" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* Search Input */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Search Media</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search videos, images..."
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 pl-10 text-sm"
                      />
                    </div>
                  </div>

                  {/* Provider Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Source</Label>
                    <Select value={searchProvider} onValueChange={setSearchProvider}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="shutterstock" className="text-white">Shutterstock</SelectItem>
                        <SelectItem value="unsplash" className="text-white">Unsplash</SelectItem>
                        <SelectItem value="pexels" className="text-white">Pexels</SelectItem>
                        <SelectItem value="pixabay" className="text-white">Pixabay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* TODO: Implement real media search integration */}
                  <div className="text-center py-8 text-zinc-500">
                    <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Media search coming soon</p>
                    <p className="text-xs mt-1">Integration with stock media providers</p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 