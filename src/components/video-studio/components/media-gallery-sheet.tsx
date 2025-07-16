"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";

interface MediaGallerySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMediaId: string;
}

export function MediaGallerySheet({ open, onOpenChange, selectedMediaId }: MediaGallerySheetProps) {
  // TODO: Implement media gallery with new video studio architecture
  // This component needs to be updated to use VideoStudioService and new types

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Media Details
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-full py-6">
          <div className="space-y-4">
            <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Info className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Media Gallery Coming Soon
              </h3>
              <p className="text-gray-500 mb-4">
                This component will be updated to work with the new video studio architecture.
              </p>
              <p className="text-sm text-gray-400">
                Selected Media ID: {selectedMediaId}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" disabled className="flex-1">
                Add to Timeline
              </Button>
              <Button variant="outline" disabled className="flex-1">
                Edit Media
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
} 