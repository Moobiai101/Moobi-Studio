"use client";

import { useState, useEffect, useCallback, FormEvent, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Wand2, Image as ImageIcon, Sparkles, Settings2, RectangleHorizontal, Users, Loader2, Video, Download, Share2 } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from "sonner";
import JSZip from 'jszip';

// Define aspect ratios for images
const imageAspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];

// Placeholder for trained models - ** This is now replaced by dynamic fetching **
// const trainedModels = ["Standard", "Photorealistic", "Artistic", "Character Model A", "Style Model B"];

// Define a type for generated image items (matching worker response)
interface GeneratedImage {
  id: string;
  prompt: string;
  aspectRatio: string;
  model?: string; // Model might not always be present if default is used
  r2_object_key: string;
  created_at: string;
  displayUrl: string; // This will hold the presigned URL from the worker
}

// Define the type for custom model items from the backend
interface CustomModel {
  id: string;
  trigger_word: string;
  training_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  error_message: string | null;
}

// Define the worker API base URL (replace if different)
const WORKER_API_URL = 'https://my-ai-worker.khansameersam96.workers.dev'; // Deployed worker URL

export default function ImageStudio() {
  const supabase = createClient();
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [aspectRatioIndex, setAspectRatioIndex] = useState(0);
  // ** Removed: const [selectedModel, setSelectedModel] = useState(trainedModels[0]); **
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  // --- State for Custom Models ---
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [selectedModelIdentifier, setSelectedModelIdentifier] = useState<string>('Standard'); // Default to Standard, store ID or trigger_word
  const [isModelsLoading, setIsModelsLoading] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Ref to store the polling interval ID
  const modelsPollingIntervalRef = useRef<NodeJS.Timeout | null>(null); 

  // State for training modal
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [triggerWord, setTriggerWord] = useState('');
  const [isTrainingSubmitting, setIsTrainingSubmitting] = useState(false);

  const currentAspectRatio = imageAspectRatios[aspectRatioIndex];

  const handleAspectRatioChange = () => {
    setAspectRatioIndex((prevIndex) => (prevIndex + 1) % imageAspectRatios.length);
  };

  const getSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // --- Fetch Models Function ---
  const fetchModels = useCallback(async () => {
    // Prevent setting loading true if polling in background
    // setIsModelsLoading(true); 
    // Set error null at start of fetch attempt
    setModelsError(null); 
    const token = await getSessionToken();

    if (!token) {
      // Don't set a global error if polling fails silently
      // setModelsError("Authentication required to load models.");
      console.warn("Polling fetchModels: Authentication required.");
      setCustomModels([]);
      // setIsModelsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${WORKER_API_URL}/api/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch models' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: CustomModel[] = await response.json();
      setCustomModels(data); // Update the models state
      // console.log("Fetched custom models (polling or initial):", data);

    } catch (error: any) {
      // Avoid spamming toasts during polling errors
      console.error("Error fetching custom models (polling or initial):", error);
      // setModelsError(error.message || "An unknown error occurred.");
      // toast.error("Failed to load custom models: " + (error.message || "Unknown error"));
      // setCustomModels([]); // Don't clear models on a failed poll, keep last known good state
    } finally {
      // Only set loading false on the *initial* load, not during polling
      // setIsModelsLoading(false); 
    }
  }, [supabase]); // Dependency array remains the same

  // Define fetchGallery using useCallback
  const fetchGallery = useCallback(async () => {
    // Set loading true when starting fetch, false in finally block
    setIsGalleryLoading(true); 
    setGalleryError(null);
    const token = await getSessionToken();

    if (!token) {
      setGalleryError("Authentication required to view gallery.");
      setGeneratedImages([]); // Clear images if not authenticated
      setIsGalleryLoading(false);
      return;
    }

    try {
      const response = await fetch(`${WORKER_API_URL}/api/gallery`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch gallery' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: GeneratedImage[] = await response.json();
      setGeneratedImages(data);
    } catch (error: any) {
      console.error("Error fetching gallery:", error);
      setGalleryError(error.message || "An unknown error occurred.");
      toast.error("Failed to load gallery: " + (error.message || "Unknown error"));
    } finally {
      setIsGalleryLoading(false); // Ensure loading is set to false
    }
  // Add supabase and other dependencies if they are used inside getSessionToken or WORKER_API_URL changes
  }, [supabase]); // Dependency array for useCallback

  // --- UseEffect to fetch data on mount ---
  useEffect(() => {
    setIsModelsLoading(true); // Set loading true only for initial fetches
    Promise.all([fetchGallery(), fetchModels()])
      .catch(err => console.error("Error during initial data fetch:", err))
      .finally(() => {
         setIsModelsLoading(false); // Set loading false after *initial* fetches complete
      });
  }, [fetchGallery, fetchModels]); 

  // --- UseEffect to check URL hash for opening training modal ---
  useEffect(() => {
    if (window.location.hash === '#train') {
      setIsTrainingModalOpen(true);
      // Optional: remove the hash after opening modal to prevent re-opening on refresh
      // window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    // Run only once on mount
  }, []);

  // --- UseEffect for Polling Model Status --- 
  useEffect(() => {
    const POLLING_INTERVAL_MS = 30000; // Poll every 30 seconds
    const MAX_PENDING_PROCESSING_AGE_MINUTES = 15; // Stop polling for jobs older than 15 minutes

    // Check if any RECENT models are in a non-final state
    const now = new Date();
    const needsPolling = customModels.some((model) => {
        const status = model.training_status;
        if (status === 'pending' || status === 'processing') {
            try {
                const createdAt = new Date(model.created_at);
                // Calculate age in minutes
                const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
                // Only consider polling if the job is younger than the threshold
                return ageMinutes < MAX_PENDING_PROCESSING_AGE_MINUTES; 
            } catch (e) {
                console.error("Error parsing model created_at date:", model.created_at, e);
                return false; // Don't poll if date is invalid
            }
        }
        return false; // Don't poll for completed or failed states
    });

    if (needsPolling && !modelsPollingIntervalRef.current) {
      // Start polling only if needed and not already running
      console.log("Starting models status polling for recent jobs...");
      modelsPollingIntervalRef.current = setInterval(() => {
        console.log("Polling for model status updates...");
        fetchModels(); 
      }, POLLING_INTERVAL_MS);
    } else if (!needsPolling && modelsPollingIntervalRef.current) {
      // Stop polling if no longer needed (no recent pending/processing jobs) or currently running
      console.log("Stopping models status polling (no recent pending/processing jobs).");
      clearInterval(modelsPollingIntervalRef.current);
      modelsPollingIntervalRef.current = null;
    }

    // Cleanup function: Stop polling when the component unmounts
    return () => {
      if (modelsPollingIntervalRef.current) {
        console.log("Clearing models status polling interval on unmount.");
        clearInterval(modelsPollingIntervalRef.current);
        modelsPollingIntervalRef.current = null;
      }
    };
  }, [customModels, fetchModels]); // Rerun this effect when models list changes

  // --- Handle Submit - Update to use selectedModelIdentifier ---
  const handleSubmit = async () => {
    setIsLoading(true);
    toast.info("Starting image generation...");
    const token = await getSessionToken();

    if (!token) {
      toast.error("Authentication required to generate images.");
      setIsLoading(false);
      return;
    }

    // Use selectedModelIdentifier in the payload
    const payload = {
      prompt,
      aspectRatio: currentAspectRatio,
      modelIdentifier: selectedModelIdentifier // Send the identifier (trigger_word or 'Standard')
    };

    console.log("Sending generation request with payload:", payload);

    try {
      const response = await fetch(`${WORKER_API_URL}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg; 
        } catch (jsonError) {
            console.error("Could not parse error response as JSON:", jsonError);
        }
        throw new Error(errorMsg);
      }

      const result = await response.json(); 
      console.log('Generation successful, worker response:', result);
      toast.success("Image generated successfully!");

      fetchGallery(); // Refresh gallery after successful generation

    } catch (error: any) {
      console.error("Image generation process failed:", error);
      toast.error("Image generation failed: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handle Training Submit - Add fetchModels call on success ---
  const handleTrainingSubmit = async (event: FormEvent<HTMLFormElement>) => {
     event.preventDefault();
    setIsTrainingSubmitting(true);
    toast.info("Preparing training data...");

    // --- Validation ---
    if (!selectedFiles || selectedFiles.length < 7) { // Example: Require min 7 images
        toast.error("Please select at least 7 images for training.");
        setIsTrainingSubmitting(false);
        return;
    }
    if (!triggerWord.trim()) {
        toast.error("Please enter a trigger word for your model.");
        setIsTrainingSubmitting(false);
        return;
    }

    // --- 1. Zip files using JSZip ---
    let zipBlob: Blob;
    try {
        const zip = new JSZip();
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            // Use original filename within the zip
            zip.file(file.name, file); 
        }
        zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        console.log("Zip file created, size:", (zipBlob.size / 1024).toFixed(2), "KB");
        toast.info("Training data zipped successfully.");
    } catch (zipError: any) {
         console.error("Error creating zip file:", zipError);
         toast.error(`Failed to zip files: ${zipError.message}`);
         setIsTrainingSubmitting(false);
         return;
    }

    // --- 2. Create FormData ---
    const formData = new FormData();
    formData.append('trigger_word', triggerWord.trim());
    // Important: Provide a filename for the blob when appending
    formData.append('zipFile', zipBlob, `${triggerWord}_training_images.zip`); 

    // --- 3. Get session token ---
    const token = await getSessionToken();
    if (!token) {
      toast.error("Authentication required to train models.");
      setIsTrainingSubmitting(false);
      return;
    }

    // --- 4. Call POST /api/train-model ---
    try {
        toast.info("Submitting training job to worker...");
        const response = await fetch(`${WORKER_API_URL}/api/train-model`, {
            method: 'POST',
            headers: {
                // Content-Type is automatically set by browser for FormData
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            // Attempt to read error message from response body
            let errorMsg = `Training submission failed! Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg; 
            } catch (jsonError) {
                console.error("Could not parse error response as JSON:", jsonError);
            }
            throw new Error(errorMsg);
        }

        // Training request was accepted by the worker (202 Accepted)
        const result = await response.json(); 
        console.log('Training job submitted successfully, worker response:', result);
        toast.success(`Training started for model: ${triggerWord}! (ID: ${result.data?.id?.substring(0, 8)}...)`);
        
        // --- 5. Handle Success: Close modal & Reset Form ---
        setIsTrainingModalOpen(false); 
        setTriggerWord(''); 
        setSelectedFiles(null);
        // Clear the file input visually
        const fileInput = document.getElementById('training-file-input') as HTMLInputElement | null;
        if(fileInput) fileInput.value = '';
        
        // *** Refresh the models list ***
        fetchModels();

    } catch (error: any) {
        console.error("Training submission failed:", error);
        toast.error(`Training submission failed: ${error.message || "Unknown error"}`);
    } finally {
        setIsTrainingSubmitting(false);
    }
  };

  // --- Handle Download ---
  const handleDownload = async (imageUrl: string, prompt: string) => {
    if (!imageUrl || imageUrl === '#placeholder' || imageUrl === '#error-generating-url') {
      toast.error("Cannot download image, URL is invalid.");
      return;
    }
    toast.info("Preparing download...");
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Create a safe filename from the prompt
      const filename = (prompt || 'generated-image').replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50) + '.png'; // Assuming png, adjust if needed
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("Image download started.");
    } catch (error: any) {
      console.error("Download failed:", error);
      toast.error(`Download failed: ${error.message}`);
    }
  };

  // --- Handle Share (Basic: Copy Link) ---
  const handleShare = (imageUrl: string) => {
     if (!imageUrl || imageUrl === '#placeholder' || imageUrl === '#error-generating-url') {
      toast.error("Cannot share image, URL is invalid.");
      return;
    }
    // Basic share: Copy image URL to clipboard
    navigator.clipboard.writeText(imageUrl)
      .then(() => {
        toast.success("Image link copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy link:", err);
        toast.error("Failed to copy image link.");
      });
    // Future enhancement: Use Web Share API if available navigator.share(...)
  };

  // --- Render Logic ---
  return (
    <div className="container mx-auto max-w-6xl py-8 flex-1 flex flex-col">
      <div className="flex flex-col items-center">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Camera className="h-8 w-8 text-primary" />
            <div className="flex flex-col items-start">
              <h1 className="text-4xl font-playfair">IMAGE STUDIO</h1>
              <p className="text-sm text-muted-foreground mt-1 font-manrope">
                Play With Our New SOTA Model, <br /> 
                Imagine Anything, Generate Anything
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-4 mb-12">
          <div 
            className={cn(
              "relative rounded-lg border border-input bg-card p-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 transition-all",
              isFocused && "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10"
            )}
          >
            <Textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Describe the image you want to generate...or train your own model!"
              rows={3}
              className="resize-none border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-3 pr-20 text-base placeholder:text-muted-foreground/60 shadow-none"
              disabled={isLoading}
            />
            <div className="absolute bottom-3 right-3">
              <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={!prompt.trim() || isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isLoading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* --- Updated Model Dropdown --- */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={isLoading || isTrainingSubmitting || isModelsLoading}>
                  <Users className="h-4 w-4" />
                  {/* Display loading state or selected model */}
                  {isModelsLoading ? 'Loading Models...' : selectedModelIdentifier}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Select Model</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Standard Base Model */}
                <DropdownMenuItem 
                    onSelect={() => setSelectedModelIdentifier('Standard')}
                    disabled={isLoading || isTrainingSubmitting}
                >
                    Standard
                </DropdownMenuItem>
                {/* Custom Models */}
                {modelsError && <DropdownMenuItem disabled className="text-red-500 text-xs">Error loading models</DropdownMenuItem>}
                {!isModelsLoading && customModels.length === 0 && !modelsError && <DropdownMenuItem disabled className="text-muted-foreground text-xs">No custom models trained</DropdownMenuItem>}
                {customModels.map((model) => (
                  <DropdownMenuItem 
                    key={model.id}
                    onSelect={() => setSelectedModelIdentifier(model.trigger_word)} // Select using trigger_word
                    disabled={isLoading || isTrainingSubmitting || model.training_status !== 'completed'} // Disable if not completed
                    className="flex justify-between items-center"
                  >
                    <span>{model.trigger_word}</span>
                    {model.training_status === 'pending' && <span className="text-xs text-muted-foreground ml-2">(Pending...)</span>}
                    {model.training_status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-2" />}
                    {model.training_status === 'failed' && <span className="text-xs text-red-500 ml-2">(Failed)</span>}
                     {/* Add tooltip for failed reason? */}
                     {model.training_status === 'failed' && model.error_message && (
                        <span title={model.error_message} className="cursor-help ml-1">ℹ️</span>
                     )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* --- Training Modal Dialog (ensure form uses correct state) --- */}
            <Dialog open={isTrainingModalOpen} onOpenChange={setIsTrainingModalOpen}>
              <DialogTrigger asChild>
                 <Button variant="outline" size="sm" className="gap-1.5" disabled={isLoading || isTrainingSubmitting}>
                  <Wand2 className="h-4 w-4" />
                  Train Model
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <form onSubmit={handleTrainingSubmit}>
                    <DialogHeader className="mb-4">
                    <DialogTitle>Train Custom Image Model</DialogTitle>
                    <DialogDescription>
                        Why take a new selfie when AI remembers your best angle? Train your own model now and generate infinite images of your choice! Because taking one good pic shouldn't mean only one post.
                    </DialogDescription>
                    </DialogHeader>

                    {/* Placeholder Example Images (Like Krea Reference) */}
                    <div className="flex justify-center items-center gap-2 my-6">
                        {/* Simple placeholder divs, replace with <img> if needed */}
                        {/* Added pulse animation with delay */}
                        <div className="w-30 h-40 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-lg shadow-md transform -rotate-6 animate-pulse duration-[4000ms] delay-[0ms]"></div>
                        {/* Added pulse animation with different delay */}
                        <div className="w-30 h-40 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg shadow-lg z-10 animate-pulse duration-[4000ms] delay-[500ms]"></div>
                        {/* Added pulse animation with yet another delay */}
                        <div className="w-30 h-40 bg-gradient-to-br from-teal-400 to-green-500 rounded-lg shadow-md transform rotate-6 animate-pulse duration-[4000ms] delay-[1000ms]"></div>
                    </div>

                    {/* Form fields with stacked labels */}
                    <div className="space-y-6"> 
                        {/* Trigger Word - Stacked */}
                        <div className="space-y-2"> 
                            <Label htmlFor="trigger-word" className="font-medium"> 
                                Trigger Word (Required) used to activate your model during generation
                            </Label>
                            <Input 
                                id="trigger-word"
                                value={triggerWord}
                                onChange={(e) => setTriggerWord(e.target.value)}
                                placeholder="e.g., mydog_style" 
                                className="col-span-3"
                                required
                                disabled={isTrainingSubmitting}
                            />
                        </div>

                        {/* Images Input - Stacked */}
                        <div className="space-y-2"> 
                            <Label htmlFor="training-file-input" className="font-medium">
                                Training Images
                            </Label>
                            <div className="space-y-2"> 
                                <Input 
                                    id="training-file-input"
                                    type="file"
                                    multiple 
                                    accept="image/*" 
                                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:bg-transparent file:text-sm file:font-medium file:text-foreground hover:file:bg-accent hover:file:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                                    required
                                    onChange={(e) => setSelectedFiles(e.target.files)}
                                    disabled={isTrainingSubmitting}
                                />
                                <p className="text-xs text-muted-foreground">Select 7+ images (10 recommended). Clear, varied examples work best.</p> 
                            </div>
                        </div>
                    </div>
                    
                    <DialogFooter className="pt-6 gap-2 sm:gap-0"> 
                         <DialogClose asChild>
                            <Button type="button" variant="outline" disabled={isTrainingSubmitting}>Cancel</Button>
                         </DialogClose>
                        <Button type="submit" disabled={!triggerWord.trim() || !selectedFiles || selectedFiles.length === 0 || isTrainingSubmitting}>
                            {isTrainingSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isTrainingSubmitting ? 'Submitting...' : 'Start Training'}
                        </Button>
                    </DialogFooter>
                 </form>
              </DialogContent>
            </Dialog>

            {/* --- Aspect Ratio Button (remains the same) --- */}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAspectRatioChange} disabled={isLoading || isTrainingSubmitting}>
              <RectangleHorizontal className="h-4 w-4" />
              {currentAspectRatio}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="w-full">
        <h2 className="text-xl font-semibold mb-6">Generated Images</h2>
        {isGalleryLoading && (
          <div className="flex justify-center items-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {galleryError && (
          <div className="text-center text-red-500 p-10">
            Error loading gallery: {galleryError}
          </div>
        )}
        {!isGalleryLoading && !galleryError && generatedImages.length === 0 && (
           <div className="text-center text-muted-foreground p-10">
            No images generated yet. Use the prompt above to create some!
          </div>
        )}
        {!isGalleryLoading && !galleryError && generatedImages.length > 0 && (
          // --- Masonry Layout using CSS columns ---
          // Responsive columns: 2 on small, 3 on md, 4 on lg, 5 on xl
          <div className="my-masonry-grid columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
            {generatedImages.map((image) => (
              // Added 'break-inside-avoid' to prevent items splitting across columns
              <div key={image.id} className="bg-card border rounded-lg overflow-hidden group cursor-pointer relative shadow-sm hover:shadow-md transition-shadow break-inside-avoid">
                <div 
                  className={cn(
                    "bg-muted flex items-center justify-center",
                    // Aspect ratio classes should work correctly now within the flow
                    image.aspectRatio === "1:1" && "aspect-square",
                    image.aspectRatio === "16:9" && "aspect-video",
                    image.aspectRatio === "9:16" && "aspect-[9/16]",
                    image.aspectRatio === "4:3" && "aspect-[4/3]",
                    image.aspectRatio === "3:4" && "aspect-[3/4]"
                  )}
                >
                  {image.displayUrl && image.displayUrl !== '#placeholder' && image.displayUrl !== '#error-generating-url' ? (
                    <img 
                      src={image.displayUrl} 
                      alt={image.prompt || 'Generated image'} 
                      className="object-cover w-full h-full" 
                      // Add loading="lazy" for performance on galleries
                      loading="lazy" 
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground/30" /> 
                  )}
                </div>
                {/* --- Hover Overlay --- */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between">
                  {/* Prompt at the bottom */}
                  <p className="text-xs text-white/90 line-clamp-3 mt-auto">{image.prompt || 'No prompt provided'}</p>
                  {/* Action buttons at the top right */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-7 w-7 text-white/80 hover:bg-black/30 hover:text-white"
                       title="Share"
                       onClick={(e) => { e.stopPropagation(); handleShare(image.displayUrl); }} // Prevent card click
                     >
                       <Share2 className="h-4 w-4" />
                     </Button>
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-7 w-7 text-white/80 hover:bg-black/30 hover:text-white"
                       title="Download"
                       onClick={(e) => { e.stopPropagation(); handleDownload(image.displayUrl, image.prompt); }} // Prevent card click
                     >
                       <Download className="h-4 w-4" />
                     </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 