"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface VideoProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoProjectDialog({ open, onOpenChange }: VideoProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">Project settings will be available soon.</p>
          <div className="flex justify-end mt-4">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 