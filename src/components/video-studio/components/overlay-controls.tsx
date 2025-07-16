import React from 'react';
import { Button } from '@/components/ui/button';
import { Layers } from 'lucide-react';

interface OverlayControlsProps {
  currentTime: number;
}

export function OverlayControls({ currentTime }: OverlayControlsProps) {
  // TODO: Implement overlay controls with new video studio architecture
  // This component needs to be updated to use VideoStudioService and new types
  
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded">
      <Button variant="outline" size="sm" disabled>
        <Layers className="w-4 h-4 mr-2" />
        Add Overlay
      </Button>
      <span className="text-xs text-gray-500">
        Time: {Math.floor(currentTime / 1000)}s
      </span>
      <span className="text-xs text-gray-400">
        (Coming soon with new architecture)
      </span>
    </div>
  );
} 