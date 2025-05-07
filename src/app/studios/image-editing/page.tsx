"use client";

import { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image'; // Use next/image for optimization
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Edit3, UploadCloud, Image as ImageIcon, Loader2, Sparkles, Wand2, X, DownloadCloud } from "lucide-react";
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from "sonner";

// Reuse Gallery Image Type (assuming structure is similar)
interface GeneratedImage {
  id: string;
  prompt: string;
  aspectRatio: string; // Keep for potential layout hints
  r2_object_key: string;
  displayUrl: string; // Proxy URL from gallery fetch
  created_at: string;
}

// Define the worker API base URL (same as image studio)
const WORKER_API_URL = 'https://my-ai-worker.khansameersam96.workers.dev';

export default function ImageEditing() {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [originalImage, setOriginalImage] = useState<{ file?: File; url?: string; id?: string; r2_key?: string } | null>(null);
  const [editedImage, setEditedImage] = useState<{ url: string; contentType: string; falRequestId?: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false); // For "Save to Assets" loading state
  const [isGalleryLoading, setIsGalleryLoading] = useState(false); // For gallery modal
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<GeneratedImage[]>([]);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false); // If gallery needs auth

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auth Helper ---
  const getSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // --- Fetch Gallery ---
  const fetchGallery = useCallback(async () => {
    setIsGalleryLoading(true);
    setGalleryError(null);
    setGalleryImages([]); // Clear previous results
    setShowLoginPrompt(false);
    const token = await getSessionToken();

    if (!token) {
      setShowLoginPrompt(true); // Show login prompt within modal
      setIsGalleryLoading(false);
      return;
    }

    try {
      const response = await fetch(`${WORKER_API_URL}/api/gallery`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        let errorMessage = "Failed to fetch gallery";
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
            errorMessage = `HTTP error! status: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data: GeneratedImage[] = await response.json();
      // Filter out items without a displayUrl just in case
      setGalleryImages(data.filter(img => img.displayUrl));

    } catch (error: any) {
      console.error("Error fetching gallery:", error);
      const displayMessage = error.message || "An unknown error occurred.";
      setGalleryError(displayMessage);
      toast.error(`Failed to load gallery: ${displayMessage}`);
    } finally {
      setIsGalleryLoading(false);
    }
  }, [supabase]);

  // --- Handlers ---
  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage({ file: file, url: reader.result as string });
        setEditedImage(null); // Reset edited image on new upload
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleGallerySelect = (image: GeneratedImage) => {
     setOriginalImage({ url: image.displayUrl, id: image.id, r2_key: image.r2_object_key });
     setEditedImage(null); // Reset edited image
     setIsGalleryModalOpen(false); // Close modal
  };

  const handleRemoveImage = () => {
    setOriginalImage(null);
    setEditedImage(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the file input
    }
  };

  // --- Submit Edit Request (Placeholder) ---
  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!originalImage || (!originalImage.file && !originalImage.r2_key)) {
      toast.error("Please select or upload an image first.");
      return;
    }
    if (!editPrompt.trim()) {
      toast.error("Please enter editing instructions.");
      return;
    }

    setIsLoading(true);
    setEditedImage(null); // Clear previous edit
    toast.info("Starting image edit...");
    const token = await getSessionToken();

    if (!token) {
      setIsLoading(false);
      toast.error("Authentication required to edit images.");
      router.push('/auth?mode=login&reason=edit');
      return;
    }

    // --- Prepare FormData ---
    const formData = new FormData();
    formData.append('editPrompt', editPrompt.trim());

    // Append original image identifier or the file itself
    if (originalImage.r2_key) {
      formData.append('originalR2Key', originalImage.r2_key);
    } else if (originalImage.file) {
      formData.append('originalImageFile', originalImage.file);
    } else {
       // This case should be prevented by the initial check, but safeguard
       toast.error("Invalid image source provided.");
       setIsLoading(false);
       return;
    }

    // --- Call Backend API ---
    try {
      console.log("Sending edit request to /api/edit-image");
      const response = await fetch(`${WORKER_API_URL}/api/edit-image`, {
        method: 'POST',
        headers: {
          // Content-Type is set automatically by fetch when using FormData
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        throw new Error(result.message || `HTTP error! status: ${response.status}`);
      }

      // --- Expect new response structure ---
      if (!result.success || !result.editedImage || !result.editedImage.temporaryUrl || !result.editedImage.contentType) {
          throw new Error("Editing process completed, but no valid image URL or content type received.");
      }

      console.log("Edit successful, Fal temporary result:", result);
      setEditedImage({ 
        url: result.editedImage.temporaryUrl,
        contentType: result.editedImage.contentType,
        falRequestId: result.editedImage.falRequestId
      }); 
      toast.success("Preview generated! You can now save it to your assets.");

    } catch (error: any) {
      console.error("Image editing failed:", error);
      toast.error(`Editing failed: ${error.message || "An unknown error occurred."}`);
      setEditedImage(null); // Ensure edited image is cleared on error
    } finally {
      setIsLoading(false);
    }
  };
  // --- End Submit Edit Request ---

  // --- Handle Commit to Assets (Placeholder for now) ---
  const handleCommitToAssets = async () => {
    if (!editedImage || !editedImage.url) {
      toast.error("No edited image to save.");
      return;
    }
    if (!originalImage) {
        toast.error("Original image context is missing for lineage."); // Clarified error
        return;
    }

    setIsCommitting(true);
    toast.info("Saving to your assets...");

    const token = await getSessionToken();
    if (!token) {
      setIsCommitting(false);
      toast.error("Authentication required to save assets.");
      router.push('/auth?mode=login&reason=save_asset');
      return;
    }

    const payload = {
        imageTemporaryUrl: editedImage.url, 
        originalPrompt: editPrompt.trim(), 
        contentType: editedImage.contentType,
        sourceStudio: 'image_editor',
        sourceGeneratedContentId: originalImage.id || null, // id from generated_content if it was a gallery selection
        // userDefinedTitle: null, // Future: get from UI input
        // userDefinedDescription: null, // Future: get from UI input
        // userDefinedTags: [], // Future: get from UI input
        generationMetadata: editedImage.falRequestId ? { falRequestId: editedImage.falRequestId } : null,
        model_used: 'fal-ai/hidream-e1-full' // Add model used
    };

    try {
        console.log("Calling /api/commit-asset with payload:", JSON.stringify(payload));
        const response = await fetch(`${WORKER_API_URL}/api/commit-asset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const commitResult = await response.json();

        if (!response.ok) {
            throw new Error(commitResult.message || `HTTP error! status: ${response.status}`);
        }
        
        if (!commitResult.success || !commitResult.asset || !commitResult.asset.displayUrl) {
            throw new Error("Asset saving reported success but did not return valid asset data.");
        }

        toast.success(commitResult.message || "Image saved to your assets successfully!");
        // Update the displayed image to the new permanent URL
        setEditedImage(prev => prev ? { ...prev, url: commitResult.asset.displayUrl } : null);
        // Optionally, clear the prompt or indicate that it's saved.
        // Consider disabling "Save to Assets" again until a new edit is made.

    } catch (error: any) {
        console.error("Failed to save asset:", error);
        toast.error(`Failed to save to assets: ${error.message}`);
    } finally {
        setIsCommitting(false);
    }
  };
  // --- End Handle Commit to Assets ---

  // Fetch gallery when modal is triggered to open
  useEffect(() => {
    if (isGalleryModalOpen) {
      fetchGallery();
    }
  }, [isGalleryModalOpen, fetchGallery]);

  // --- Render ---
  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 flex-1 flex flex-col">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Edit3 className="h-8 w-8 text-primary" />
          <div className="flex flex-col items-start">
            <h1 className="text-4xl font-playfair">IMAGE EDITOR</h1>
            <p className="text-sm text-muted-foreground mt-1 font-manrope">
              Modify your images using AI prompts.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-8 flex-1">

        {/* Left Panel: Image Selection & Prompt */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          {/* Image Selection Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">1. Select Image</CardTitle>
              <CardDescription>Upload or choose from your gallery.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {!originalImage ? (
                <>
                  {/* Hidden File Input */}
                  <Input
                    ref={fileInputRef}
                    id="image-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp" // Specify acceptable types
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isLoading}
                  />
                  {/* Upload Button */}
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={triggerFileUpload}
                    disabled={isLoading}
                  >
                    <UploadCloud className="h-5 w-5" />
                    Upload Image
                  </Button>

                  {/* Or Separator */}
                  <div className="flex items-center w-full">
                    <div className="flex-grow border-t border-muted"></div>
                    <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">Or</span>
                    <div className="flex-grow border-t border-muted"></div>
                  </div>

                  {/* Select from Gallery Button */}
                  <Dialog open={isGalleryModalOpen} onOpenChange={setIsGalleryModalOpen}>
                    <DialogTrigger asChild>
                       <Button variant="outline" className="w-full gap-2" disabled={isLoading}>
                          <ImageIcon className="h-5 w-5" />
                          Choose from Gallery
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>Select Image from Gallery</DialogTitle>
                        <DialogDescription>
                          Choose an image you previously generated.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 min-h-0">
                          {showLoginPrompt && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="mb-4 text-muted-foreground">Login required to view your gallery.</p>
                                <Button asChild size="sm">
                                    <Link href="/auth">Login / Signup</Link>
                                </Button>
                            </div>
                          )}
                          {!showLoginPrompt && isGalleryLoading && (
                            <div className="flex items-center justify-center h-full">
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          {!showLoginPrompt && galleryError && (
                            <div className="flex items-center justify-center h-full text-red-600">
                              Error: {galleryError}
                            </div>
                          )}
                          {!showLoginPrompt && !isGalleryLoading && !galleryError && galleryImages.length === 0 && (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              Your gallery is empty. Generate some images first!
                            </div>
                          )}
                          {!showLoginPrompt && !isGalleryLoading && !galleryError && galleryImages.length > 0 && (
                            <ScrollArea className="h-full pr-4">
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {galleryImages.map((image) => (
                                    <button
                                        key={image.id}
                                        className={cn(
                                            "relative aspect-square rounded-md overflow-hidden border border-transparent hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all group",
                                            // Add potential aspect ratio classes if needed, or keep square
                                            "bg-muted"
                                        )}
                                        onClick={() => handleGallerySelect(image)}
                                        title={image.prompt || 'Generated Image'}
                                    >
                                    <Image
                                        src={image.displayUrl}
                                        alt={image.prompt || 'Gallery image'}
                                        fill // Use fill with aspect ratio container
                                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw" // Optimize image loading
                                        className="object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    </button>
                                ))}
                                </div>
                            </ScrollArea>
                          )}
                      </div>
                       <DialogClose asChild className="mt-4">
                           <Button type="button" variant="outline">Cancel</Button>
                       </DialogClose>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                // Show Thumbnail and Remove Button
                 <div className="w-full aspect-video rounded-md overflow-hidden relative border bg-muted group">
                   {originalImage.url && (
                       <Image
                           src={originalImage.url}
                           alt="Selected image"
                           fill
                           className="object-contain" // Use contain to see the whole image
                           sizes="33vw"
                       />
                   )}
                   <Button
                       variant="destructive"
                       size="icon"
                       className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                       onClick={handleRemoveImage}
                       title="Remove Image"
                       disabled={isLoading}
                   >
                       <X className="h-4 w-4" />
                   </Button>
                 </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt Input Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">2. Describe Edit</CardTitle>
              <CardDescription>Tell the AI what changes to make.</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                   <Textarea
                     value={editPrompt}
                     onChange={(e) => setEditPrompt(e.target.value)}
                     placeholder="e.g., 'make the sky look like a sunset', 'add sunglasses to the person', 'remove the car in the background'"
                     rows={4}
                     className="resize-none focus-visible:ring-primary/50"
                     disabled={isLoading || !originalImage}
                   />
                   <Button
                      type="submit"
                      disabled={isLoading || !originalImage || !editPrompt.trim() || isCommitting}
                      className="w-full gap-2"
                   >
                     {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                     {isLoading ? 'Applying Edit...' : 'Apply Edit'}
                   </Button>
               </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Image Display */}
        <div className="w-full lg:w-2/3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Original Image Display */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">Original Image</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center bg-muted/50 rounded-b-md overflow-hidden p-4">
                {originalImage?.url ? (
                  <div className="relative w-full h-full max-h-[60vh]">
                    <Image
                      src={originalImage.url}
                      alt="Original image"
                      fill
                      className="object-contain" // Contain to show aspect ratio correctly
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground text-center p-8">
                    <ImageIcon className="h-16 w-16 mb-4" />
                    <p>Upload or select an image to start editing.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edited Image Display */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Edited Image</CardTitle>
                {editedImage?.url && !isLoading && (
                    <Button 
                        size="sm" 
                        className="gap-1.5"
                        onClick={handleCommitToAssets}
                        disabled={isCommitting || isLoading}
                    >
                        {isCommitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                        {isCommitting ? 'Saving...' : 'Save to Assets'}
                    </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center bg-muted/50 rounded-b-md overflow-hidden p-4">
                {isLoading && (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <p>Editing in progress...</p>
                  </div>
                )}
                {!isLoading && editedImage?.url && (
                   <div className="relative w-full h-full max-h-[60vh]">
                      <Image
                        src={editedImage.url}
                        alt="Edited image"
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                   </div>
                )}
                {!isLoading && !editedImage?.url && originalImage && (
                    <div className="flex flex-col items-center text-muted-foreground text-center p-8">
                        <Wand2 className="h-16 w-16 mb-4" />
                        <p>Enter instructions and click 'Apply Edit' to see the result here.</p>
                    </div>
                )}
                 {!isLoading && !editedImage?.url && !originalImage && (
                    <div className="flex flex-col items-center text-muted-foreground text-center p-8 opacity-50">
                        <ImageIcon className="h-16 w-16 mb-4" />
                        <p>The edited image will appear here.</p>
                    </div>
                 )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 