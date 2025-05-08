"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Download, Trash2, Info, Loader2, LogIn, Tag, Calendar, FileType, Sparkles } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import { toast } from "sonner";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Define the worker API base URL
const WORKER_API_URL = 'https://my-ai-worker.khansameersam96.workers.dev';

// Interface for User Asset
interface UserAsset {
  id: string;
  title: string | null;
  description: string | null;
  tags: string[] | null;
  r2_object_key: string;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  source_studio: string;
  source_prompt: string | null;
  model_used: string | null;
  created_at: string;
  displayUrl: string;
}

export default function MyAssetsPage() {
  const supabase = createClient();
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<UserAsset | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Helper function to get session token
  const getSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Fetch assets from the worker API
  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setShowLoginPrompt(false);
    
    const token = await getSessionToken();

    if (!token) {
      setShowLoginPrompt(true);
      setAssets([]);
      setIsLoading(false);
      return;
    }

    try {
      // Call a new API endpoint for assets - this needs to be created in the worker
      const response = await fetch(`${WORKER_API_URL}/api/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        let errorMessage = "Failed to fetch assets";
        try {
          const errorData = await response.json();
          if (errorData && typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          console.error("Could not parse error response as JSON:", parseError);
          errorMessage = `HTTP error! status: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data: UserAsset[] = await response.json();
      setAssets(data);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      const displayMessage = error.message || "An unknown error occurred while fetching assets.";
      setError(displayMessage);
      toast.error(displayMessage);
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Fetch assets on mount
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Handle asset download
  const handleDownload = async (asset: UserAsset) => {
    try {
      // Fetch the image from the displayUrl
      const response = await fetch(asset.displayUrl);
      if (!response.ok) throw new Error('Failed to download asset');
      
      const blob = await response.blob();
      
      // Create an object URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = asset.file_name || `asset-${asset.id}.${asset.content_type.split('/')[1] || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Asset downloaded successfully');
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error.message || 'Failed to download asset');
    }
  };

  // Handle asset deletion
  const handleDelete = async (asset: UserAsset) => {
    setIsDeleting(true);
    
    try {
      const token = await getSessionToken();
      if (!token) {
        toast.error('Please log in to delete assets');
        return;
      }
      
      const response = await fetch(`${WORKER_API_URL}/api/assets/${asset.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete asset');
      }
      
      // Remove the asset from state
      setAssets(assets.filter(a => a.id !== asset.id));
      if (selectedAsset?.id === asset.id) {
        setSelectedAsset(null);
        setIsDetailsOpen(false);
      }
      
      toast.success('Asset deleted successfully');
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error(error.message || 'Failed to delete asset');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open asset details dialog
  const openDetails = (asset: UserAsset) => {
    setSelectedAsset(asset);
    setIsDetailsOpen(true);
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter assets based on active tab
  const filteredAssets = assets.filter(asset => {
    if (activeTab === "all") return true;
    return asset.source_studio === activeTab;
  });

  // Group assets by source for counting
  const assetCounts = assets.reduce((acc, asset) => {
    const source = asset.source_studio;
    if (!acc[source]) acc[source] = 0;
    acc[source]++;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto max-w-7xl py-8 flex-1 flex flex-col">
      <div className="flex flex-col items-center mb-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <ImageIcon className="h-8 w-8 text-primary" />
            <div className="flex flex-col items-start">
              <h1 className="text-4xl font-playfair">MY ASSETS</h1>
              <p className="text-sm text-muted-foreground mt-1 font-manrope">
                Manage all your saved creations in one place
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              All Assets
              <Badge variant="secondary" className="ml-1 py-0 h-5">{assets.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="image_studio" className="gap-1.5">
              Image Studio
              <Badge variant="secondary" className="ml-1 py-0 h-5">{assetCounts['image_studio'] || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="image_editor" className="gap-1.5">
              Image Editor
              <Badge variant="secondary" className="ml-1 py-0 h-5">{assetCounts['image_editor'] || 0}</Badge>
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={fetchAssets} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Refresh
          </Button>
        </div>

        <TabsContent value={activeTab} className="w-full">
          {showLoginPrompt && (
            <div className="text-center flex justify-center py-10">
              <Button 
                asChild 
                size="lg" 
                className={cn(
                  "gap-2",
                  "bg-gradient-to-r from-sidebar-primary via-primary to-sidebar-primary animate-background-pan bg-[length:200%_auto]",
                  "hover:brightness-110 transition-all"
                )}
              >
                <Link href="/auth">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login / Signup
                </Link>
              </Button>
            </div>
          )}

          {!showLoginPrompt && isLoading && (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!showLoginPrompt && error && (
            <div className="text-center text-red-500 p-10 border border-dashed border-red-500/30 rounded-lg bg-red-500/5">
              Error loading assets: {error}
            </div>
          )}
          
          {!showLoginPrompt && !isLoading && !error && filteredAssets.length === 0 && (
            <div className="text-center text-muted-foreground p-10 border border-dashed border-border rounded-lg bg-card/50">
              No assets found. Save some from Image Studio or Image Editor!
            </div>
          )}
          
          {!showLoginPrompt && !isLoading && !error && filteredAssets.length > 0 && (
            <div className="my-masonry-grid columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {filteredAssets.map((asset) => (
                <Card key={asset.id} className="break-inside-avoid mb-4 overflow-hidden group cursor-pointer relative shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative">
                    <CardContent className="p-0 aspect-square bg-muted">
                      {asset.displayUrl ? (
                        <img 
                          src={asset.displayUrl} 
                          alt={asset.title || 'Asset'} 
                          className="object-cover w-full h-full"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between">
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-white/80 hover:bg-black/30 hover:text-white"
                                  onClick={(e) => { e.stopPropagation(); openDetails(asset); }}
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-white/80 hover:bg-black/30 hover:text-white"
                                  onClick={(e) => { e.stopPropagation(); handleDownload(asset); }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Download</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-white/80 hover:bg-red-500/30 hover:text-red-500"
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (confirm('Are you sure you want to delete this asset?')) {
                                      handleDelete(asset);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                  <CardFooter className="p-3 flex-col items-start">
                    <h3 className="text-sm font-medium line-clamp-1">
                      {asset.title || 'Untitled Asset'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Asset Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-3xl">
          {selectedAsset && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAsset.title || 'Asset Details'}</DialogTitle>
                <DialogDescription>
                  Saved on {formatDate(selectedAsset.created_at)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid md:grid-cols-[1fr_1.2fr] gap-6 my-4">
                <div className="bg-muted rounded-lg overflow-hidden aspect-square">
                  <img 
                    src={selectedAsset.displayUrl} 
                    alt={selectedAsset.title || 'Asset'} 
                    className="object-cover w-full h-full"
                  />
                </div>
                
                <div className="flex flex-col gap-3">
                  <ScrollArea className="h-[280px] pr-4">
                    {selectedAsset.description && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-1">Description</h4>
                        <p className="text-sm text-muted-foreground">{selectedAsset.description}</p>
                      </div>
                    )}
                    
                    {selectedAsset.source_prompt && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-1">Original Prompt</h4>
                        <p className="text-sm text-muted-foreground">{selectedAsset.source_prompt}</p>
                      </div>
                    )}
                    
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-1">Details</h4>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-sm">
                          <FileType className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{selectedAsset.content_type}</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Download className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatFileSize(selectedAsset.file_size_bytes)}</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatDate(selectedAsset.created_at)}</span>
                        </li>
                        {selectedAsset.model_used && (
                          <li className="flex items-center gap-2 text-sm">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Model: {selectedAsset.model_used}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                    
                    {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {selectedAsset.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
              
              <DialogFooter className="gap-2">
                <Button variant="destructive" onClick={() => handleDelete(selectedAsset)} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete
                </Button>
                <Button variant="secondary" onClick={() => handleDownload(selectedAsset)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 