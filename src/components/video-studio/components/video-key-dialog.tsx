"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Key, 
  Eye, 
  EyeOff, 
  Check, 
  X,
  ExternalLink,
  AlertTriangle
} from "lucide-react";

interface VideoKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoKeyDialog({ open, onOpenChange }: VideoKeyDialogProps) {
  const [apiKeys, setApiKeys] = useState({
    falAi: localStorage.getItem("fal_ai_key") || "",
    openai: localStorage.getItem("openai_key") || "",
    elevenlabs: localStorage.getItem("elevenlabs_key") || "",
    replicate: localStorage.getItem("replicate_key") || "",
  });

  const [showKeys, setShowKeys] = useState({
    falAi: false,
    openai: false,
    elevenlabs: false,
    replicate: false,
  });

  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const providers = [
    {
      id: "falAi",
      name: "fal.ai",
      description: "AI video generation and processing",
      website: "https://fal.ai",
      keyFormat: "fal_key_...",
      required: true,
    },
    {
      id: "openai",
      name: "OpenAI",
      description: "GPT models for text generation",
      website: "https://platform.openai.com",
      keyFormat: "sk-...",
      required: false,
    },
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      description: "AI voice synthesis",
      website: "https://elevenlabs.io",
      keyFormat: "...",
      required: false,
    },
    {
      id: "replicate",
      name: "Replicate",
      description: "AI model hosting platform",
      website: "https://replicate.com",
      keyFormat: "r8_...",
      required: false,
    },
  ];

  const updateApiKey = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider as keyof typeof prev] }));
  };

  const testApiKey = async (provider: string) => {
    const key = apiKeys[provider as keyof typeof apiKeys];
    if (!key) return;

    setTesting(prev => ({ ...prev, [provider]: true }));
    
    try {
      // Simulate API key testing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock test results - in real app this would make actual API calls
      const isValid = key.length > 10; // Simple validation
      setTestResults(prev => ({ ...prev, [provider]: isValid }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [provider]: false }));
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const saveApiKeys = () => {
    // Save to localStorage (in production, this should be more secure)
    Object.entries(apiKeys).forEach(([provider, key]) => {
      if (key) {
        localStorage.setItem(`${provider.replace(/([A-Z])/g, '_$1').toLowerCase()}_key`, key);
      } else {
        localStorage.removeItem(`${provider.replace(/([A-Z])/g, '_$1').toLowerCase()}_key`);
      }
    });
    
    onOpenChange(false);
  };

  const clearApiKey = (provider: string) => {
    updateApiKey(provider, "");
    setTestResults(prev => ({ ...prev, [provider]: null }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API Keys Configuration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              API keys are stored locally in your browser. For production use, consider using environment variables or a secure key management service.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="providers" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="providers">API Providers</TabsTrigger>
              <TabsTrigger value="help">Help & Documentation</TabsTrigger>
            </TabsList>

            <TabsContent value="providers" className="space-y-4">
              {providers.map((provider) => (
                <div key={provider.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{provider.name}</h3>
                        {provider.required && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">Format: {provider.keyFormat}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(provider.website, '_blank')}
                          className="h-auto p-0 text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Get API Key
                        </Button>
                      </div>
                    </div>
                    
                    {testResults[provider.id] !== undefined && (
                      <div className="flex items-center gap-1">
                        {testResults[provider.id] ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKeys[provider.id as keyof typeof showKeys] ? "text" : "password"}
                          value={apiKeys[provider.id as keyof typeof apiKeys]}
                          onChange={(e) => updateApiKey(provider.id, e.target.value)}
                          placeholder={`Enter your ${provider.name} API key`}
                          className="pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleShowKey(provider.id)}
                          className="absolute right-0 top-0 h-full px-3"
                        >
                          {showKeys[provider.id as keyof typeof showKeys] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      
                      <Button
                        variant="outline"
                        onClick={() => testApiKey(provider.id)}
                        disabled={!apiKeys[provider.id as keyof typeof apiKeys] || testing[provider.id]}
                      >
                        {testing[provider.id] ? "Testing..." : "Test"}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        onClick={() => clearApiKey(provider.id)}
                        disabled={!apiKeys[provider.id as keyof typeof apiKeys]}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {testResults[provider.id] === true && (
                      <p className="text-sm text-green-600">✓ API key is valid</p>
                    )}
                    {testResults[provider.id] === false && (
                      <p className="text-sm text-red-600">✗ API key is invalid or expired</p>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="help" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Getting Started</h3>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>To use AI features in the video studio, you'll need API keys from the respective providers:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li><strong>fal.ai</strong> - Required for video generation and processing</li>
                      <li><strong>OpenAI</strong> - Optional for text generation and AI assistance</li>
                      <li><strong>ElevenLabs</strong> - Optional for AI voice synthesis</li>
                      <li><strong>Replicate</strong> - Optional for additional AI models</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Security Notes</h3>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>API keys are stored locally in your browser</li>
                      <li>Keys are not sent to our servers</li>
                      <li>Clear your browser data to remove stored keys</li>
                      <li>Never share your API keys with others</li>
                      <li>Regenerate keys if you suspect they've been compromised</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Troubleshooting</h3>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Ensure your API key has the correct permissions</li>
                      <li>Check that your account has sufficient credits</li>
                      <li>Verify the key format matches the expected pattern</li>
                      <li>Try regenerating the key if tests continue to fail</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveApiKeys}>
            Save API Keys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 