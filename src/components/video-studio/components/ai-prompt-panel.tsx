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

interface AIPromptPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function AIPromptPanel({ isCollapsed, onToggleCollapse }: AIPromptPanelProps) {
  const [activeTab, setActiveTab] = useState("text-to-video");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Form state
  const [textPrompt, setTextPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("minimax");
  const [duration, setDuration] = useState([5]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("standard");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProvider, setSearchProvider] = useState("shutterstock");
  
  // Mock search results
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
    setIsGenerating(true);
    setGenerationProgress(0);
    
    // Simulate generation progress
    const interval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const models = {
    "text-to-video": [
      { id: "minimax", name: "Minimax Video-01", description: "High quality, fast generation" },
      { id: "hunyuan", name: "Hunyuan Video", description: "Creative and artistic" },
      { id: "ltx", name: "LTX Video", description: "Photorealistic results" }
    ],
    "image-to-video": [
      { id: "stable-video", name: "Stable Video Diffusion", description: "Smooth motion" },
      { id: "kling", name: "Kling Video", description: "Professional quality" }
    ],
    "frame-interpolation": [
      { id: "film", name: "FILM", description: "High-quality interpolation" },
      { id: "rife", name: "RIFE", description: "Real-time processing" }
    ]
  };

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
                    <Tabs value="text-to-video" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-zinc-800 h-8">
                        <TabsTrigger value="text-to-video" className="text-xs px-2">
                          <Video className="w-3 h-3 mr-1" />
                          Text
                        </TabsTrigger>
                        <TabsTrigger value="image-to-video" className="text-xs px-2">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          Image
                        </TabsTrigger>
                        <TabsTrigger value="frame-interpolation" className="text-xs px-2">
                          <Film className="w-3 h-3 mr-1" />
                          Frame
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
                      placeholder="Describe the video you want to generate..."
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none h-20 text-sm"
                    />
                    <div className="text-xs text-zinc-500 text-right">
                      {textPrompt.length}/500
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">AI Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white text-sm h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {models["text-to-video"].map((model) => (
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
                      max={30}
                      min={2}
                      step={1}
                      className="w-full"
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
                    <Select value={quality} onValueChange={setQuality}>
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
                  <Button
                    onClick={handleGenerate}
                    disabled={!textPrompt.trim() || isGenerating}
                    className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Generating... {generationProgress}%
                      </div>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Video
                      </>
                    )}
                  </Button>

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
                        Estimated time: 2-3 minutes
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

                  {/* Search Filters */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-zinc-300">Filters</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
                      >
                        <Video className="w-3 h-3 mr-1" />
                        Videos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
                      >
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Images
                      </Button>
                    </div>
                  </div>

                  {/* Search Results */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-zinc-300">Results</Label>
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-xs">
                        {mockSearchResults.length} items
                      </Badge>
                    </div>
                    
                    {mockSearchResults.map((result) => (
                      <Card key={result.id} className="bg-zinc-800 border-zinc-700">
                        <CardContent className="p-3">
                          <div className="aspect-video bg-zinc-700 rounded mb-2 relative overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center">
                              {result.type === "video" ? (
                                <Video className="w-8 h-8 text-zinc-500" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-zinc-500" />
                              )}
                            </div>
                            {result.duration && (
                              <Badge className="absolute bottom-2 right-2 bg-black/60 text-white text-xs">
                                {result.duration}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium text-white truncate">
                              {result.title}
                            </h4>
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                              <span>{result.provider}</span>
                              <span>{result.license}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 h-7 text-xs flex-1">
                              <Plus className="w-3 h-3 mr-1" />
                              Add to Timeline
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600 h-7 w-7 p-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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