"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Moveable from 'react-moveable';
import { useVideoProject } from '../hooks/use-video-project';
import '../styles/transform-controls.css';

// Professional Moveable styling
const moveableStyles = `
  .moveable-professional .moveable-line {
    background: #3b82f6 !important;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
  }
  
  .moveable-professional .moveable-control {
    background: #ffffff !important;
    border: 2px solid #3b82f6 !important;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    width: 10px !important;
    height: 10px !important;
  }
  
  .moveable-professional .moveable-control:hover {
    background: #3b82f6 !important;
    transform: scale(1.2);
    transition: all 0.15s ease;
  }
  
  .moveable-professional .moveable-rotation {
    background: #ffffff !important;
    border: 2px solid #3b82f6 !important;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }
  
  .moveable-professional .moveable-rotation:hover {
    background: #3b82f6 !important;
    transform: scale(1.2);
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('moveable-professional-styles')) {
  const style = document.createElement('style');
  style.id = 'moveable-professional-styles';
  style.textContent = moveableStyles;
  document.head.appendChild(style);
}

// Production-grade transform data structure
// DATABASE STORAGE NEEDED: This transform data should be stored in database for persistence across sessions
interface OverlayTransform {
  id: string;
  position: { x: number; y: number };
  scale: { x: number; y: number };
  rotation: number;
  opacity: number;
  anchorPoint: { x: number; y: number };
  zIndex: number;
  // Professional video editor properties
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light';
  cropBox?: { x: number; y: number; width: number; height: number };
  maskEnabled: boolean;
  // Keyframe data (for future animation support)
  keyframes?: Array<{
    time: number;
    transform: Partial<OverlayTransform>;
  }>;
  // Metadata for undo/redo
  lastModified: number;
  modifiedBy?: string; // For collaborative editing
}

// BROWSER STORAGE: Current selection and UI state can use localStorage/sessionStorage
interface TransformUIState {
  selectedOverlayId: string | null;
  isTransforming: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

interface VideoTransformControlsProps {
  overlays: any[]; // Array of overlay clips
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  onTransformUpdate: (overlayId: string, transform: any) => void;
  currentTime: number;
}

export function VideoTransformControls({
  overlays,
  videoContainerRef,
  onTransformUpdate,
  currentTime
}: VideoTransformControlsProps) {
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const moveableRef = useRef<Moveable>(null);
  const [frame, setFrame] = useState({
    translate: [0, 0],
    rotate: 0,
  });

  // Memoize active overlays to prevent recreating on every render
  const activeOverlays = useMemo(() => 
    overlays.filter(overlay => 
    currentTime >= overlay.startTime && currentTime <= overlay.endTime
    ),
    [overlays, currentTime]
  );

  // Initialize frame from selected overlay's transform
  useEffect(() => {
    if (!selectedOverlayId) return;
    
    // Find overlay from the original overlays array to avoid dependency on activeOverlays
    const overlay = overlays.find(o => o.id === selectedOverlayId);
    if (!overlay) return;
    
    const transform = overlay.overlayTransform || {};
    const newFrame = {
      translate: [transform.position?.x || 0, transform.position?.y || 0] as [number, number],
      rotate: transform.rotation || 0,
    };
    
    // Only update if values actually changed
    setFrame(prevFrame => {
      if (
        prevFrame.translate[0] === newFrame.translate[0] &&
        prevFrame.translate[1] === newFrame.translate[1] &&
        prevFrame.rotate === newFrame.rotate
      ) {
        return prevFrame; // No change, return same reference
      }
      return newFrame;
    });
  }, [selectedOverlayId, overlays]);

  // Handle overlay selection by clicking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const overlayElement = target.closest('[data-overlay-id]') as HTMLElement;
      
      if (overlayElement && !target.closest('.moveable-control')) {
        const overlayId = overlayElement.getAttribute('data-overlay-id');
        if (overlayId) {
          // Check if this overlay is currently active
          const isActive = activeOverlays.some(o => o.id === overlayId);
          if (isActive) {
            setSelectedOverlayId(overlayId);
          }
          e.stopPropagation(); // Prevent click from bubbling
          return;
        }
      }
      
      // Deselect if clicked outside
      if (!target.closest('.moveable-control') && !overlayElement) {
        setSelectedOverlayId(null);
      }
    };

    document.addEventListener('click', handleClick, true); // Use capture phase
    return () => document.removeEventListener('click', handleClick, true);
  }, [activeOverlays]);

  // Deselect overlay if it's no longer active
  useEffect(() => {
    if (selectedOverlayId && !activeOverlays.some(o => o.id === selectedOverlayId)) {
      setSelectedOverlayId(null);
    }
  }, [selectedOverlayId, activeOverlays]);

  // Get the selected overlay element
  const getTargetElement = useCallback(() => {
    if (!selectedOverlayId || !videoContainerRef.current) return null;
    return videoContainerRef.current.querySelector(`[data-overlay-id="${selectedOverlayId}"]`) as HTMLElement;
  }, [selectedOverlayId, videoContainerRef]);

  // Update transform on parent
  const updateTransform = useCallback((transform: any) => {
    if (!selectedOverlayId) return;
    onTransformUpdate(selectedOverlayId, transform);
  }, [selectedOverlayId, onTransformUpdate]);

  const targetElement = getTargetElement();

  // Apply transform to element directly
  const applyTransform = useCallback((element: HTMLElement, position: { x: number, y: number }, scale: { x: number, y: number }, rotation: number) => {
    // Apply transform directly to the overlay container div (parent of video/image)
    const parentElement = element.parentElement;
    if (parentElement) {
      parentElement.style.transform = `translate(${position.x}px, ${position.y}px) scale(${scale.x}, ${scale.y}) rotate(${rotation}deg)`;
    }
  }, []);

  return (
    <>
      {/* Moveable controller */}
      {selectedOverlayId && targetElement && (
        <Moveable
          ref={moveableRef}
          target={targetElement}
          container={videoContainerRef.current}
          
          // Core features
          draggable={true}
          resizable={true}
          rotatable={true}
          
          // Options
          keepRatio={true}
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          edge={true}
          origin={false}
          
          // Visual
          renderDirections={["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
          className="moveable-professional"
          zoom={1}
          rotationPosition={"top"}
          
          // Event handlers
          onDragStart={e => {
            e.set(frame.translate);
          }}
          
          onDrag={e => {
            frame.translate = e.beforeTranslate;
            e.target.style.transform = `translate(${e.beforeTranslate[0]}px, ${e.beforeTranslate[1]}px) rotate(${frame.rotate}deg)`;
          }}
          
          onDragEnd={() => {
            updateTransform({
              position: { x: frame.translate[0], y: frame.translate[1] },
              lastModified: Date.now()
            });
          }}
          
          onResizeStart={e => {
            e.setOrigin(["%", "%"]);
            e.dragStart && e.dragStart.set(frame.translate);
          }}
          
          onResize={e => {
            const beforeTranslate = e.drag.beforeTranslate;
            frame.translate = beforeTranslate;
            e.target.style.width = `${e.width}px`;
            e.target.style.height = `${e.height}px`;
            e.target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px) rotate(${frame.rotate}deg)`;
          }}
          
          onResizeEnd={e => {
            if (!videoContainerRef.current) return;

            // The base width of the overlay is 50% of the container.
            const containerWidth = videoContainerRef.current.offsetWidth;
            const baseWidth = containerWidth * 0.5;
            
            // The new width after resizing in pixels.
            const newWidth = e.lastEvent.width;
            
            // Calculate the new scale relative to the base size.
            const newScale = newWidth / baseWidth;
              
              updateTransform({
                position: { x: frame.translate[0], y: frame.translate[1] },
              scale: { x: newScale, y: newScale },
                lastModified: Date.now()
              });
          }}
          
          onRotateStart={e => {
            e.set(frame.rotate);
          }}
          
          onRotate={e => {
            frame.rotate = e.beforeRotate;
            e.target.style.transform = `translate(${frame.translate[0]}px, ${frame.translate[1]}px) rotate(${e.beforeRotate}deg)`;
          }}
          
          onRotateEnd={() => {
            updateTransform({
              position: { x: frame.translate[0], y: frame.translate[1] },
              rotation: frame.rotate,
              lastModified: Date.now()
            });
          }}
        />
      )}
      
      {/* Selection outline for active overlays */}
      {activeOverlays.map(overlay => {
        const element = videoContainerRef.current?.querySelector(`[data-overlay-id="${overlay.id}"]`) as HTMLElement;
        if (!element) return null;
        
        const isSelected = selectedOverlayId === overlay.id;
        
        // Don't show outline for selected item as Moveable handles it
        if (isSelected) return null;
        
        const rect = element.getBoundingClientRect();
        const containerRect = videoContainerRef.current!.getBoundingClientRect();
        
        return (
          <div
            key={overlay.id}
            className="absolute pointer-events-none"
            style={{
              left: rect.left - containerRect.left,
              top: rect.top - containerRect.top,
              width: rect.width,
              height: rect.height,
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '4px',
              opacity: 0.5,
              transition: 'all 0.15s ease',
              zIndex: 100001
            }}
          />
        );
      })}
    </>
  );
}

// PRODUCTION HELPER: Database save function (implement based on your backend)
/*
const debouncedSaveTransform = debounce(async (overlayId: string, transform: OverlayTransform) => {
  try {
    await fetch('/api/overlays/transform', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overlayId, transform })
    });
    console.log('✅ Transform saved to database');
  } catch (error) {
    console.error('❌ Failed to save transform:', error);
    // Could implement retry logic or offline storage here
  }
}, 500);
*/
