/**
 * Media Recovery Hook
 * 
 * Automatically detects and recovers previously uploaded media files
 * using the fingerprinting system when users re-upload files
 */

import { useState, useCallback, useEffect } from 'react';
import { videoStudioDB } from '@/lib/indexeddb/video-studio-db';
import FileFingerprinting, { FileFingerprint, FileMatchResult } from '@/lib/fingerprinting/file-fingerprinting';
import { VideoStudioService } from '@/services/video-studio-service';
import { toast } from 'sonner';

interface MediaRecoveryState {
  isProcessing: boolean;
  recoveredFiles: Array<{
    file: File;
    fingerprint: string;
    matchResult: FileMatchResult;
    recovered: boolean;
  }>;
  totalFiles: number;
  processedFiles: number;
}

interface UseMediaRecoveryReturn {
  recoveryState: MediaRecoveryState;
  processFiles: (files: File[]) => Promise<void>;
  acceptRecovery: (fingerprint: string) => Promise<void>;
  rejectRecovery: (fingerprint: string) => Promise<void>;
  clearRecoveryState: () => void;
}

/**
 * Hook for automatic media recovery
 */
export function useMediaRecovery(): UseMediaRecoveryReturn {
  const [recoveryState, setRecoveryState] = useState<MediaRecoveryState>({
    isProcessing: false,
    recoveredFiles: [],
    totalFiles: 0,
    processedFiles: 0,
  });

  /**
   * Process uploaded files for recovery
   */
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setRecoveryState({
      isProcessing: true,
      recoveredFiles: [],
      totalFiles: files.length,
      processedFiles: 0,
    });

    try {
      const recoveredFiles: MediaRecoveryState['recoveredFiles'] = [];
      let processedCount = 0;

      for (const file of files) {
        try {
          // Generate fingerprint for the file
          const fingerprint = await FileFingerprinting.generateFingerprint(file);
          
          // Check for matches
          const matches = await FileFingerprinting.findMatchingFiles(fingerprint);
          
          if (matches.length > 0) {
            // Found potential matches - add to recovery list
            const bestMatch = matches[0]; // Highest confidence match
            
            recoveredFiles.push({
              file,
              fingerprint: fingerprint.sha256,
              matchResult: bestMatch,
              recovered: false,
            });
            
            console.log(`🔍 Found potential match for ${file.name}:`, bestMatch);
          } else {
            // No matches found - this is a new file
            // Store fingerprint for future recovery
            await FileFingerprinting.storeFingerprint(fingerprint);
            
            // Store file in IndexedDB
            await videoStudioDB.storeMediaFile(fingerprint.sha256, file, {
              original_filename: file.name,
              file_size: file.size,
              content_type: file.type,
              duration: fingerprint.contentAnalysis.durationMs,
              created_at: new Date().toISOString(),
            });
          }
          
          processedCount++;
          setRecoveryState(prev => ({
            ...prev,
            processedFiles: processedCount,
            recoveredFiles: [...recoveredFiles],
          }));
          
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
          processedCount++;
          setRecoveryState(prev => ({
            ...prev,
            processedFiles: processedCount,
          }));
        }
      }

      // Show recovery notification if matches found
      if (recoveredFiles.length > 0) {
        toast.success(
          `🔄 Found ${recoveredFiles.length} previously uploaded file${recoveredFiles.length === 1 ? '' : 's'}!`,
          {
            description: 'Click to review and recover your files.',
            duration: 10000,
          }
        );
      }

    } catch (error) {
      console.error('File processing failed:', error);
      toast.error('Failed to process files for recovery');
    } finally {
      setRecoveryState(prev => ({
        ...prev,
        isProcessing: false,
      }));
    }
  }, []);

  /**
   * Accept recovery for a specific file
   */
  const acceptRecovery = useCallback(async (fingerprint: string) => {
    try {
      // Find the file in recovery state
      const recoveredFile = recoveryState.recoveredFiles.find(f => f.fingerprint === fingerprint);
      if (!recoveredFile) return;

      // Get the cached file from IndexedDB
      const cachedFile = await videoStudioDB.getMediaFile(recoveredFile.matchResult.fingerprint);
      
      if (cachedFile) {
        // File recovered successfully
        setRecoveryState(prev => ({
          ...prev,
          recoveredFiles: prev.recoveredFiles.map(f => 
            f.fingerprint === fingerprint ? { ...f, recovered: true } : f
          ),
        }));

        toast.success(`✅ Recovered ${recoveredFile.file.name} from cache`);
        
        // The file is now available in IndexedDB for use
        console.log(`📦 File recovered: ${recoveredFile.file.name}`);
      } else {
        // Fallback: store the new file
        await videoStudioDB.storeMediaFile(fingerprint, recoveredFile.file, {
          original_filename: recoveredFile.file.name,
          file_size: recoveredFile.file.size,
          content_type: recoveredFile.file.type,
          duration: undefined,
          created_at: new Date().toISOString(),
        });
        
        toast.info(`📁 Stored new copy of ${recoveredFile.file.name}`);
      }
      
    } catch (error) {
      console.error('Recovery failed:', error);
      toast.error('Failed to recover file');
    }
  }, [recoveryState.recoveredFiles]);

  /**
   * Reject recovery for a specific file (treat as new)
   */
  const rejectRecovery = useCallback(async (fingerprint: string) => {
    try {
      const recoveredFile = recoveryState.recoveredFiles.find(f => f.fingerprint === fingerprint);
      if (!recoveredFile) return;

      // Generate new fingerprint and store as new file
      const newFingerprint = await FileFingerprinting.generateFingerprint(recoveredFile.file);
      await FileFingerprinting.storeFingerprint(newFingerprint);
      
      await videoStudioDB.storeMediaFile(newFingerprint.sha256, recoveredFile.file, {
        original_filename: recoveredFile.file.name,
        file_size: recoveredFile.file.size,
        content_type: recoveredFile.file.type,
        duration: newFingerprint.contentAnalysis.durationMs,
        created_at: new Date().toISOString(),
      });

      // Remove from recovery list
      setRecoveryState(prev => ({
        ...prev,
        recoveredFiles: prev.recoveredFiles.filter(f => f.fingerprint !== fingerprint),
      }));

      toast.success(`📁 Stored ${recoveredFile.file.name} as new file`);
      
    } catch (error) {
      console.error('Failed to reject recovery:', error);
      toast.error('Failed to store file');
    }
  }, [recoveryState.recoveredFiles]);

  /**
   * Clear recovery state
   */
  const clearRecoveryState = useCallback(() => {
    setRecoveryState({
      isProcessing: false,
      recoveredFiles: [],
      totalFiles: 0,
      processedFiles: 0,
    });
  }, []);

  return {
    recoveryState,
    processFiles,
    acceptRecovery,
    rejectRecovery,
    clearRecoveryState,
  };
}

/**
 * Hook for media recovery dialog
 */
export function useMediaRecoveryDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const recovery = useMediaRecovery();

  const openDialog = useCallback(() => {
    if (recovery.recoveryState.recoveredFiles.length > 0) {
      setIsOpen(true);
    }
  }, [recovery.recoveryState.recoveredFiles.length]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    recovery.clearRecoveryState();
  }, [recovery]);

  // Auto-open dialog when recoverable files are found
  useEffect(() => {
    if (recovery.recoveryState.recoveredFiles.length > 0 && !recovery.recoveryState.isProcessing) {
      openDialog();
    }
  }, [recovery.recoveryState.recoveredFiles.length, recovery.recoveryState.isProcessing, openDialog]);

  return {
    isOpen,
    openDialog,
    closeDialog,
    recovery,
  };
}

export default useMediaRecovery; 