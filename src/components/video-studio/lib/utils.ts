import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Parse time string (MM:SS or HH:MM:SS) to seconds
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(":").map(Number);
  
  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

/**
 * Convert pixels to time based on timeline zoom and scale
 */
export function pixelsToTime(pixels: number, zoom: number, timelineWidth: number, duration: number): number {
  const pixelsPerSecond = (timelineWidth * zoom) / duration;
  return pixels / pixelsPerSecond;
}

/**
 * Convert time to pixels based on timeline zoom and scale
 */
export function timeToPixels(time: number, zoom: number, timelineWidth: number, duration: number): number {
  const pixelsPerSecond = (timelineWidth * zoom) / duration;
  return time * pixelsPerSecond;
}

/**
 * Snap time to grid based on snap settings
 */
export function snapToGrid(time: number, snapInterval: number = 1): number {
  return Math.round(time / snapInterval) * snapInterval;
}

/**
 * Get video metadata from file
 */
export function getVideoMetadata(file: File): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30, // Default FPS, would need more complex detection for actual FPS
      });
    };
    
    video.onerror = () => {
      reject(new Error("Failed to load video metadata"));
    };
    
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Get audio metadata from file
 */
export function getAudioMetadata(file: File): Promise<{
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    
    audio.onloadedmetadata = () => {
      resolve({
        duration: audio.duration,
      });
    };
    
    audio.onerror = () => {
      reject(new Error("Failed to load audio metadata"));
    };
    
    audio.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail from video file
 */
export function generateVideoThumbnail(file: File, time: number = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }
    
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = time;
    };
    
    video.onseeked = () => {
      ctx.drawImage(video, 0, 0);
      const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
      resolve(thumbnail);
    };
    
    video.onerror = () => {
      reject(new Error("Failed to generate thumbnail"));
    };
    
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Check if file is supported video format
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

/**
 * Check if file is supported audio format
 */
export function isAudioFile(file: File): boolean {
  return file.type.startsWith("audio/");
}

/**
 * Check if file is supported image format
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
} 