"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { 
  Move, 
  Maximize2, 
  RotateCcw, 
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoProject } from "../hooks/use-video-project";

interface OverlayControlsProps {
  selectedClip: any;
  currentTime: number;
}

export function OverlayControls({ selectedClip, currentTime }: OverlayControlsProps) {
  const { updateClip } = useVideoProject();
  
  if (!selectedClip || selectedClip.asset?.type === 'audio') {
    return null;
  }

  const isOverlay = selectedClip.trackId && selectedClip.trackId.includes('overlay');
  const transform = selectedClip.overlayTransform || {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    opacity: 1
  };

  const handleTransformChange = (key: string, value: any) => {
    const newTransform = { ...transform };
    
    if (key === 'position.x') {
      newTransform.position.x = value;
    } else if (key === 'position.y') {
      newTransform.position.y = value;
    } else if (key === 'scale') {
      newTransform.scale = { x: value / 100, y: value / 100 };
    } else if (key === 'rotation') {
      newTransform.rotation = value;
    } else if (key === 'opacity') {
      newTransform.opacity = value / 100;
    }
    
    updateClip(selectedClip.id, { overlayTransform: newTransform });
  };

  const handleReset = () => {
    updateClip(selectedClip.id, {
      overlayTransform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        opacity: 1
      }
    });
  };

  return (
    <Card className="absolute bottom-4 left-4 w-80 bg-zinc-900/95 backdrop-blur-sm border-zinc-800 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Transform Controls
          </h3>
          {isOverlay && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Reset Transform"
                onClick={handleReset}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Position Controls */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Position</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-xs text-zinc-500">X</span>
              <Slider
                value={[transform.position.x]}
                min={-100}
                max={100}
                step={1}
                className="w-full"
                onValueChange={([value]) => handleTransformChange('position.x', value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-zinc-500">Y</span>
              <Slider
                value={[transform.position.y]}
                min={-100}
                max={100}
                step={1}
                className="w-full"
                onValueChange={([value]) => handleTransformChange('position.y', value)}
              />
            </div>
          </div>
        </div>

        {/* Scale Controls */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Scale</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[transform.scale.x * 100]}
              min={10}
              max={200}
              step={1}
              className="flex-1"
              onValueChange={([value]) => handleTransformChange('scale', value)}
            />
            <span className="text-xs text-zinc-500 w-10 text-right">
              {Math.round(transform.scale.x * 100)}%
            </span>
          </div>
        </div>

        {/* Rotation Control */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Rotation</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[transform.rotation]}
              min={-180}
              max={180}
              step={1}
              className="flex-1"
              onValueChange={([value]) => handleTransformChange('rotation', value)}
            />
            <span className="text-xs text-zinc-500 w-10 text-right">
              {transform.rotation}°
            </span>
          </div>
        </div>

        {/* Opacity Control */}
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Opacity</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[transform.opacity * 100]}
              min={0}
              max={100}
              step={1}
              className="flex-1"
              onValueChange={([value]) => handleTransformChange('opacity', value)}
            />
            <span className="text-xs text-zinc-500 w-10 text-right">
              {Math.round(transform.opacity * 100)}%
            </span>
          </div>
        </div>

        {/* Clip Info */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 space-y-1">
            <div>Clip: {selectedClip.asset?.title || 'Untitled'}</div>
            <div>Duration: {((selectedClip.endTime - selectedClip.startTime).toFixed(2))}s</div>
            <div>Current: {currentTime.toFixed(2)}s</div>
          </div>
        </div>
      </div>
    </Card>
  );
} 