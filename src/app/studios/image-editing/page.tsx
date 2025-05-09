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
import { Edit3, UploadCloud, Image as ImageIcon, Loader2, Sparkles, Wand2, X, DownloadCloud, PencilLine } from "lucide-react";
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
  content_type?: string;
}

// Define the worker API base URL (same as image studio)
const WORKER_API_URL = 'https://my-ai-worker.khansameersam96.workers.dev';

export default function ImageEditing() {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [originalImage, setOriginalImage] = useState<{ file?: File; url?: string; id?: string; r2_key?: string; contentType?: string } | null>(null);
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
        setOriginalImage({ file: file, url: reader.result as string, contentType: file.type });
        setEditedImage(null);
        setEditPrompt('');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleGallerySelect = (image: GeneratedImage) => {
     setOriginalImage({ url: image.displayUrl, id: image.id, r2_key: image.r2_object_key, contentType: image.content_type || 'image/jpeg' });
     setEditedImage(null);
     setEditPrompt('');
     setIsGalleryModalOpen(false);
  };

  const handleRemoveImage = () => {
    setOriginalImage(null);
    setEditedImage(null);
    setEditPrompt('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  // --- Submit Edit Request (Placeholder) ---
  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!originalImage || (!originalImage.file && !originalImage.r2_key && !originalImage.url && !originalImage.contentType)) {
      toast.error("Please select or upload an image first.");
      return;
    }
    if (!editPrompt.trim()) {
      toast.error("Please enter editing instructions.");
      return;
    }

    setIsLoading(true);
    setEditedImage(null);
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
    } else if (originalImage.url && originalImage.contentType) {
      formData.append('originalImageUrl', originalImage.url);
      formData.append('originalImageContentType', originalImage.contentType);
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
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

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
      setEditedImage(null);
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
        toast.error("Original image context is missing for lineage.");
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
        sourceGeneratedContentId: originalImage.id || null,
        generationMetadata: editedImage.falRequestId ? { falRequestId: editedImage.falRequestId } : null,
        model_used: 'fal-ai/hidream-e1-full'
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
        setEditedImage(prev => prev ? { ...prev, url: commitResult.asset.displayUrl } : null);

    } catch (error: any) {
        console.error("Failed to save asset:", error);
        toast.error(`Failed to save to assets: ${error.message}`);
    } finally {
        setIsCommitting(false);
    }
  };
  // --- End Handle Commit to Assets ---

  // --- Handle Use Edited Image as New Original ---
  const handleUseEditedAsOriginal = () => {
    if (editedImage && editedImage.url) {
      setOriginalImage({
        url: editedImage.url,
        contentType: editedImage.contentType,
        file: undefined,
        id: undefined,
        r2_key: undefined,
      });
      setEditedImage(null);
      setEditPrompt('');
      toast.info("Edited image set as new original. Describe further changes.");
    }
  };
  // --- End Handle Use Edited Image as New Original ---

  // Fetch gallery when modal is triggered to open
  useEffect(() => {
    if (isGalleryModalOpen) {
      fetchGallery();
    }
  }, [isGalleryModalOpen, fetchGallery]);

  // --- Render ---
  return (
    <div className="container mx-auto max-w-7xl py-12 px-4 flex-1 flex flex-col bg-gray-900 text-gray-100 min-h-screen">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Edit3 className="h-10 w-10 text-primary" />
          <div className="flex flex-col items-start">
            <h1 className="text-5xl font-playfair text-gray-50">IMAGE EDITOR</h1>
            <p className="text-md text-gray-400 mt-1 font-manrope">
              Transform your visuals with AI. Upload, describe, and create.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-8 flex-1">

        {/* Left Panel: Image Selection & Prompt */}
        <div className="w-full lg:w-2/5 xl:w-1/3 flex flex-col gap-6">
          {/* Image Selection Card */}
          <Card className="shadow-xl bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-xl text-gray-200">1. Choose Source Image</CardTitle>
              <CardDescription className="text-gray-400">Upload a new image or pick one from your gallery.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {!originalImage ? (
                <>
                  {/* Hidden File Input */}
                  <Input
                    ref={fileInputRef}
                    id="image-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isLoading}
                  />
                  {/* Upload Button */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 py-3 text-lg bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary hover:text-primary-hover"
                    onClick={triggerFileUpload}
                    disabled={isLoading}
                  >
                    <UploadCloud className="h-6 w-6" />
                    Upload Image
                  </Button>

                  {/* Or Separator */}
                  <div className="flex items-center w-full">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink mx-4 text-xs text-gray-500 uppercase">Or</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                  </div>

                  {/* Select from Gallery Button */}
                  <Dialog open={isGalleryModalOpen} onOpenChange={setIsGalleryModalOpen}>
                    <DialogTrigger asChild>
                       <Button variant="outline" className="w-full gap-2 py-3 text-lg bg-gray-700/50 hover:bg-gray-700 border-gray-600 text-gray-300 hover:text-gray-100" disabled={isLoading}>
                          <ImageIcon className="h-6 w-6" />
                          Choose from Gallery
                       </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col bg-gray-800 border-gray-700 text-gray-200">
                      <DialogHeader>
                        <DialogTitle className="text-gray-100">Select Image from Gallery</DialogTitle>
                        <DialogDescription className="text-gray-400">
                          Choose an image you previously generated or saved.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-1 min-h-0">
                          {showLoginPrompt && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="mb-4 text-gray-400">Login required to view your gallery.</p>
                                <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    <Link href="/auth">Login / Signup</Link>
                                </Button>
                            </div>
                          )}
                          {!showLoginPrompt && isGalleryLoading && (
                            <div className="flex items-center justify-center h-full">
                              <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            </div>
                          )}
                          {!showLoginPrompt && galleryError && (
                            <div className="flex items-center justify-center h-full text-red-400">
                              Error: {galleryError}
                            </div>
                          )}
                          {!showLoginPrompt && !isGalleryLoading && !galleryError && galleryImages.length === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-500">
                              Your gallery is empty. Generate some images first!
                            </div>
                          )}
                          {!showLoginPrompt && !isGalleryLoading && !galleryError && galleryImages.length > 0 && (
                            <ScrollArea className="h-full pr-4">
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-3">
                                {galleryImages.map((image) => (
                                    <button
                                        key={image.id}
                                        className={cn(
                                            "relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-800 transition-all group",
                                            "bg-gray-700"
                                        )}
                                        onClick={() => handleGallerySelect(image)}
                                        title={image.prompt || 'Gallery Image'}
                                    >
                                    <Image
                                        src={image.displayUrl}
                                        alt={image.prompt || 'Gallery image'}
                                        fill
                                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-300"></div>
                                    </button>
                                ))}
                                </div>
                            </ScrollArea>
                          )}
                      </div>
                       <DialogClose asChild className="mt-4">
                           <Button type="button" variant="outline" className="bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300 hover:text-gray-100">Cancel</Button>
                       </DialogClose>
                    </DialogContent>
                  </Dialog>
                </>
              ) : (
                // Show Thumbnail and Remove Button
                 <div className="w-full aspect-video rounded-lg overflow-hidden relative border border-gray-700 bg-gray-700/30 group">
                   {originalImage.url && (
                       <Image
                           src={originalImage.url}
                           alt="Selected image"
                           fill
                           className="object-contain"
                           sizes="33vw"
                       />
                   )}
                   <Button
                       variant="destructive"
                       size="icon"
                       className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-red-500/80 hover:bg-red-500"
                       onClick={handleRemoveImage}
                       title="Remove Image"
                       disabled={isLoading}
                   >
                       <X className="h-5 w-5" />
                   </Button>
                 </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt Input Card */}
          <Card className="shadow-xl bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-xl text-gray-200">2. Describe Your Edit</CardTitle>
              <CardDescription className="text-gray-400">Tell the AI what changes to make to the image.</CardDescription>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                   <Textarea
                     value={editPrompt}
                     onChange={(e) => setEditPrompt(e.target.value)}
                     placeholder="e.g., 'Make the sky a vibrant sunset', 'add futuristic sunglasses', 'remove the background car'"
                     rows={5}
                     className="resize-none focus-visible:ring-primary/50 bg-gray-700 border-gray-600 placeholder-gray-500 text-gray-200 rounded-md p-3"
                     disabled={isLoading || !originalImage}
                   />
                   <Button
                      type="submit"
                      disabled={isLoading || !originalImage || !editPrompt.trim() || isCommitting}
                      className="w-full gap-2 py-3 text-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white rounded-md transition-all duration-300 transform hover:scale-105"
                   >
                     {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                     {isLoading ? 'Applying Edit...' : 'Apply AI Edit'}
                   </Button>
               </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Image Display */}
        <div className="w-full lg:w-3/5 xl:w-2/3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            {/* Original Image Display */}
            <Card className="shadow-xl bg-gray-800 border-gray-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-xl text-gray-200">Original Image</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center bg-gray-800/30 rounded-b-lg overflow-hidden p-4 min-h-[300px] md:min-h-[400px]">
                {originalImage?.url ? (
                  <div className="relative w-full h-full max-h-[70vh]">
                    <Image
                      src={originalImage.url}
                      alt="Original image"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-500 text-center p-8">
                    <ImageIcon className="h-20 w-20 mb-4 opacity-50" />
                    <p className="text-lg">Upload or select an image to start editing.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edited Image Display */}
            <Card className="shadow-xl bg-gray-800 border-gray-700 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl text-gray-200">Edited Image</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center bg-gray-800/30 rounded-b-lg overflow-hidden p-4 min-h-[300px] md:min-h-[400px] relative group">
                {isLoading && (
                  <div className="flex flex-col items-center text-gray-400">
                    <Loader2 className="h-16 w-16 animate-spin mb-4 text-primary" />
                    <p className="text-lg">AI is working its magic...</p>
                  </div>
                )}
                {!isLoading && editedImage?.url && (
                   <div className="relative w-full h-full max-h-[70vh]">
                      <Image
                        src={editedImage.url}
                        alt="Edited image"
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4">
                        <Button
                            size="lg"
                            className="w-full max-w-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-base"
                            onClick={handleCommitToAssets}
                            disabled={isCommitting || isLoading}
                        >
                            {isCommitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <DownloadCloud className="h-5 w-5" />}
                            {isCommitting ? 'Saving...' : 'Save to My Assets'}
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="w-full max-w-xs gap-2 border-gray-500 text-gray-300 hover:bg-gray-700 hover:text-gray-100 rounded-md text-base bg-gray-700/50 hover:border-gray-400"
                            onClick={handleUseEditedAsOriginal}
                            disabled={isLoading || isCommitting}
                        >
                            <PencilLine className="h-5 w-5" />
                            Edit This Image Further
                        </Button>
                      </div>
                   </div>
                )}
                {!isLoading && !editedImage?.url && originalImage && (
                    <div className="flex flex-col items-center text-gray-500 text-center p-8">
                        <Wand2 className="h-20 w-20 mb-4 opacity-50" />
                        <p className="text-lg">Enter instructions and click 'Apply AI Edit' to see the result.</p>
                    </div>
                )}
                 {!isLoading && !editedImage?.url && !originalImage && (
                    <div className="flex flex-col items-center text-gray-600 text-center p-8 opacity-70">
                        <ImageIcon className="h-20 w-20 mb-4" />
                        <p className="text-lg">The edited masterpiece will appear here.</p>
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