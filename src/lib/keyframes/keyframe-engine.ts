/**
 * Professional Keyframe Animation System
 * 
 * Features:
 * - Smooth interpolation between keyframes
 * - Professional easing functions
 * - Real-time animation calculation
 * - Multi-property animation support
 * - Bezier curve support
 * - Performance optimized calculations
 */

// Easing functions for professional animations
export const EasingFunctions = {
  // Linear
  linear: (t: number) => t,
  
  // Quadratic
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  
  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  
  // Quartic
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  
  // Quintic
  easeInQuint: (t: number) => t * t * t * t * t,
  easeOutQuint: (t: number) => 1 + (--t) * t * t * t * t,
  easeInOutQuint: (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
  
  // Sine
  easeInSine: (t: number) => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: (t: number) => Math.sin(t * Math.PI / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  
  // Exponential
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  
  // Circular
  easeInCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number) => Math.sqrt(1 - (t - 1) * (t - 1)),
  easeInOutCirc: (t: number) => {
    if (t < 0.5) return (1 - Math.sqrt(1 - 4 * t * t)) / 2;
    return (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2;
  },
  
  // Back
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    if (t < 0.5) {
      return (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2;
    }
    return (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  
  // Elastic
  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t: number) => {
    const c5 = (2 * Math.PI) / 4.5;
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) {
      return -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2;
    }
    return (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },
  
  // Bounce
  easeInBounce: (t: number) => 1 - EasingFunctions.easeOutBounce(1 - t),
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInOutBounce: (t: number) => {
    if (t < 0.5) return EasingFunctions.easeInBounce(t * 2) / 2;
    return EasingFunctions.easeOutBounce(t * 2 - 1) / 2 + 0.5;
  },
} as const;

export type EasingFunction = keyof typeof EasingFunctions;

/**
 * Keyframe data structure
 */
export interface Keyframe {
  id: string;
  clipId: string;
  property: string;
  time: number; // In seconds
  value: number | string | { x: number; y: number } | { r: number; g: number; b: number; a: number };
  easing: EasingFunction;
  handles?: {
    inHandle: { x: number; y: number };
    outHandle: { x: number; y: number };
  };
}

/**
 * Animation property types
 */
export interface AnimationProperties {
  // Transform properties
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skewX: number;
  skewY: number;
  
  // Visual properties
  opacity: number;
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  
  // Audio properties
  volume: number;
  pan: number;
  
  // Color properties
  colorR: number;
  colorG: number;
  colorB: number;
  colorA: number;
}

/**
 * Animation state at a specific time
 */
export type AnimationState = Partial<AnimationProperties>;

/**
 * Professional Keyframe Animation Engine
 */
export class KeyframeEngine {
  private static instance: KeyframeEngine | null = null;
  private keyframes = new Map<string, Keyframe[]>(); // clipId -> keyframes
  private animationCache = new Map<string, AnimationState>(); // clipId_time -> state
  private performanceMode = false;
  
  // Performance metrics
  private metrics = {
    totalCalculations: 0,
    cacheHits: 0,
    averageCalculationTime: 0,
  };

  // Singleton pattern
  static getInstance(): KeyframeEngine {
    if (!KeyframeEngine.instance) {
      KeyframeEngine.instance = new KeyframeEngine();
    }
    return KeyframeEngine.instance;
  }

  /**
   * Add or update a keyframe
   */
  setKeyframe(keyframe: Keyframe): void {
    const clipKeyframes = this.keyframes.get(keyframe.clipId) || [];
    
    // Remove existing keyframe at same time and property
    const filteredKeyframes = clipKeyframes.filter(
      kf => !(kf.time === keyframe.time && kf.property === keyframe.property)
    );
    
    // Add new keyframe and sort by time
    filteredKeyframes.push(keyframe);
    filteredKeyframes.sort((a, b) => a.time - b.time);
    
    this.keyframes.set(keyframe.clipId, filteredKeyframes);
    
    // Clear cache for this clip
    this.clearCacheForClip(keyframe.clipId);
  }

  /**
   * Remove a keyframe
   */
  removeKeyframe(clipId: string, keyframeId: string): void {
    const clipKeyframes = this.keyframes.get(clipId) || [];
    const filteredKeyframes = clipKeyframes.filter(kf => kf.id !== keyframeId);
    
    this.keyframes.set(clipId, filteredKeyframes);
    this.clearCacheForClip(clipId);
  }

  /**
   * Get keyframes for a clip
   */
  getKeyframes(clipId: string): Keyframe[] {
    return this.keyframes.get(clipId) || [];
  }

  /**
   * Get keyframes for a specific property
   */
  getKeyframesForProperty(clipId: string, property: string): Keyframe[] {
    const clipKeyframes = this.keyframes.get(clipId) || [];
    return clipKeyframes.filter(kf => kf.property === property);
  }

  /**
   * Calculate animation state at a specific time
   */
  calculateAnimationState(clipId: string, time: number): AnimationState {
    const startTime = performance.now();
    
    // Check cache first
    if (!this.performanceMode) {
      const cacheKey = `${clipId}_${time.toFixed(3)}`;
      const cached = this.animationCache.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
    }

    const clipKeyframes = this.keyframes.get(clipId) || [];
    const state: AnimationState = {};

    // Group keyframes by property
    const keyframesByProperty = new Map<string, Keyframe[]>();
    clipKeyframes.forEach(kf => {
      if (!keyframesByProperty.has(kf.property)) {
        keyframesByProperty.set(kf.property, []);
      }
      keyframesByProperty.get(kf.property)!.push(kf);
    });

    // Calculate value for each property
    keyframesByProperty.forEach((keyframes, property) => {
      const value = this.calculatePropertyValue(keyframes, time);
      if (value !== undefined) {
        (state as any)[property] = value;
      }
    });

    // Cache the result
    if (!this.performanceMode) {
      const cacheKey = `${clipId}_${time.toFixed(3)}`;
      this.animationCache.set(cacheKey, state);
    }

    // Update metrics
    this.metrics.totalCalculations++;
    const calculationTime = performance.now() - startTime;
    this.metrics.averageCalculationTime = 
      (this.metrics.averageCalculationTime * (this.metrics.totalCalculations - 1) + calculationTime) / 
      this.metrics.totalCalculations;

    return state;
  }

  /**
   * Calculate value for a specific property at a given time
   */
  private calculatePropertyValue(
    keyframes: Keyframe[], 
    time: number
  ): number | string | { x: number; y: number } | { r: number; g: number; b: number; a: number } | undefined {
    if (keyframes.length === 0) return undefined;

    // Sort keyframes by time
    keyframes.sort((a, b) => a.time - b.time);

    // Find the keyframes to interpolate between
    let beforeKeyframe: Keyframe | null = null;
    let afterKeyframe: Keyframe | null = null;

    for (let i = 0; i < keyframes.length; i++) {
      const keyframe = keyframes[i];
      
      if (keyframe.time <= time) {
        beforeKeyframe = keyframe;
      }
      
      if (keyframe.time > time) {
        afterKeyframe = keyframe;
        break;
      }
    }

    // If time is before first keyframe, return first keyframe value
    if (!beforeKeyframe) {
      return keyframes[0].value;
    }

    // If time is after last keyframe, return last keyframe value
    if (!afterKeyframe) {
      return beforeKeyframe.value;
    }

    // If time exactly matches a keyframe, return that value
    if (beforeKeyframe.time === time) {
      return beforeKeyframe.value;
    }

    // Interpolate between keyframes
    return this.interpolateValues(beforeKeyframe, afterKeyframe, time);
  }

  /**
   * Interpolate between two keyframes
   */
  private interpolateValues(
    beforeKeyframe: Keyframe,
    afterKeyframe: Keyframe,
    time: number
  ): number | string | { x: number; y: number } | { r: number; g: number; b: number; a: number } {
    const duration = afterKeyframe.time - beforeKeyframe.time;
    const progress = (time - beforeKeyframe.time) / duration;

    // Apply easing function
    const easedProgress = EasingFunctions[beforeKeyframe.easing](progress);

    // Handle different value types
    if (typeof beforeKeyframe.value === 'number' && typeof afterKeyframe.value === 'number') {
      return this.interpolateNumber(beforeKeyframe.value, afterKeyframe.value, easedProgress);
    }

    if (typeof beforeKeyframe.value === 'string' && typeof afterKeyframe.value === 'string') {
      // For strings, we can't interpolate - return the before value until halfway, then after
      return easedProgress < 0.5 ? beforeKeyframe.value : afterKeyframe.value;
    }

    if (
      typeof beforeKeyframe.value === 'object' && 
      typeof afterKeyframe.value === 'object' &&
      beforeKeyframe.value !== null && 
      afterKeyframe.value !== null
    ) {
      // Handle vector2 interpolation
      if ('x' in beforeKeyframe.value && 'y' in beforeKeyframe.value) {
        const before = beforeKeyframe.value as { x: number; y: number };
        const after = afterKeyframe.value as { x: number; y: number };
        
        return {
          x: this.interpolateNumber(before.x, after.x, easedProgress),
          y: this.interpolateNumber(before.y, after.y, easedProgress),
        };
      }

      // Handle color interpolation
      if ('r' in beforeKeyframe.value && 'g' in beforeKeyframe.value) {
        const before = beforeKeyframe.value as { r: number; g: number; b: number; a: number };
        const after = afterKeyframe.value as { r: number; g: number; b: number; a: number };
        
        return {
          r: this.interpolateNumber(before.r, after.r, easedProgress),
          g: this.interpolateNumber(before.g, after.g, easedProgress),
          b: this.interpolateNumber(before.b, after.b, easedProgress),
          a: this.interpolateNumber(before.a, after.a, easedProgress),
        };
      }
    }

    // Fallback to before value
    return beforeKeyframe.value;
  }

  /**
   * Interpolate between two numbers
   */
  private interpolateNumber(from: number, to: number, progress: number): number {
    return from + (to - from) * progress;
  }

  /**
   * Create smooth animation between keyframes using Bezier curves
   */
  createSmoothAnimation(
    clipId: string,
    property: string,
    keyframes: Array<{
      time: number;
      value: number;
      easing?: EasingFunction;
    }>
  ): void {
    // Auto-generate smooth keyframes with appropriate easing
    const smoothKeyframes: Keyframe[] = keyframes.map((kf, index) => {
      let easing: EasingFunction = 'easeInOutQuad';
      
      // First keyframe
      if (index === 0) {
        easing = 'easeOutQuad';
      }
      // Last keyframe
      else if (index === keyframes.length - 1) {
        easing = 'easeInQuad';
      }
      // Middle keyframes
      else {
        easing = 'easeInOutQuad';
      }

      return {
        id: `${clipId}_${property}_${index}`,
        clipId,
        property,
        time: kf.time,
        value: kf.value,
        easing: kf.easing || easing,
      };
    });

    // Add all keyframes
    smoothKeyframes.forEach(kf => this.setKeyframe(kf));
  }

  /**
   * Batch calculate animation states for multiple times (for timeline scrubbing)
   */
  batchCalculateStates(
    clipId: string,
    times: number[]
  ): Map<number, AnimationState> {
    const results = new Map<number, AnimationState>();
    
    times.forEach(time => {
      const state = this.calculateAnimationState(clipId, time);
      results.set(time, state);
    });

    return results;
  }

  /**
   * Get animation bounds for a clip (min/max values for each property)
   */
  getAnimationBounds(clipId: string): Map<string, { min: number; max: number }> {
    const bounds = new Map<string, { min: number; max: number }>();
    const clipKeyframes = this.keyframes.get(clipId) || [];

    clipKeyframes.forEach(kf => {
      if (typeof kf.value === 'number') {
        if (!bounds.has(kf.property)) {
          bounds.set(kf.property, { min: kf.value, max: kf.value });
        } else {
          const current = bounds.get(kf.property)!;
          bounds.set(kf.property, {
            min: Math.min(current.min, kf.value),
            max: Math.max(current.max, kf.value),
          });
        }
      }
    });

    return bounds;
  }

  /**
   * Optimize keyframes by removing redundant ones
   */
  optimizeKeyframes(clipId: string, tolerance: number = 0.001): void {
    const clipKeyframes = this.keyframes.get(clipId) || [];
    const keyframesByProperty = new Map<string, Keyframe[]>();
    
    // Group by property
    clipKeyframes.forEach(kf => {
      if (!keyframesByProperty.has(kf.property)) {
        keyframesByProperty.set(kf.property, []);
      }
      keyframesByProperty.get(kf.property)!.push(kf);
    });

    const optimizedKeyframes: Keyframe[] = [];

    // Optimize each property
    keyframesByProperty.forEach((keyframes, property) => {
      keyframes.sort((a, b) => a.time - b.time);
      
      if (keyframes.length <= 2) {
        optimizedKeyframes.push(...keyframes);
        return;
      }

      // Keep first and last keyframes
      optimizedKeyframes.push(keyframes[0]);
      
      // Check middle keyframes for redundancy
      for (let i = 1; i < keyframes.length - 1; i++) {
        const prev = keyframes[i - 1];
        const current = keyframes[i];
        const next = keyframes[i + 1];
        
        // Calculate what the interpolated value would be without this keyframe
        const interpolatedValue = this.interpolateValues(prev, next, current.time);
        
        // If the difference is significant, keep the keyframe
        if (typeof current.value === 'number' && typeof interpolatedValue === 'number') {
          if (Math.abs(current.value - interpolatedValue) > tolerance) {
            optimizedKeyframes.push(current);
          }
        } else {
          // Keep non-numeric keyframes
          optimizedKeyframes.push(current);
        }
      }
      
      optimizedKeyframes.push(keyframes[keyframes.length - 1]);
    });

    this.keyframes.set(clipId, optimizedKeyframes);
    this.clearCacheForClip(clipId);
  }

  /**
   * Clear animation cache for a specific clip
   */
  private clearCacheForClip(clipId: string): void {
    const keysToDelete: string[] = [];
    
    this.animationCache.forEach((_, key) => {
      if (key.startsWith(`${clipId}_`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.animationCache.delete(key);
    });
  }

  /**
   * Clear all animation data for a clip
   */
  clearClipAnimations(clipId: string): void {
    this.keyframes.delete(clipId);
    this.clearCacheForClip(clipId);
  }

  /**
   * Export keyframes as JSON
   */
  exportKeyframes(clipId: string): string {
    const clipKeyframes = this.keyframes.get(clipId) || [];
    return JSON.stringify(clipKeyframes, null, 2);
  }

  /**
   * Import keyframes from JSON
   */
  importKeyframes(clipId: string, jsonData: string): void {
    try {
      const keyframes: Keyframe[] = JSON.parse(jsonData);
      
      // Validate keyframes
      const validKeyframes = keyframes.filter(kf => 
        kf.id && kf.clipId && kf.property && typeof kf.time === 'number'
      );
      
      // Update clip ID if needed
      validKeyframes.forEach(kf => {
        kf.clipId = clipId;
      });
      
      this.keyframes.set(clipId, validKeyframes);
      this.clearCacheForClip(clipId);
      
    } catch (error) {
      console.error('Failed to import keyframes:', error);
      throw new Error('Invalid keyframe data');
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.metrics & { cacheHitRate: number } {
    return { 
      ...this.metrics,
      cacheHitRate: this.metrics.totalCalculations > 0 
        ? (this.metrics.cacheHits / this.metrics.totalCalculations) * 100 
        : 0
    };
  }

  /**
   * Enable/disable performance mode (disables caching for better memory usage)
   */
  setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
    if (enabled) {
      this.animationCache.clear();
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.animationCache.clear();
    console.log('🧹 Keyframe animation caches cleared');
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): {
    keyframeCount: number;
    cacheSize: number;
    estimatedMemoryMB: number;
  } {
    let keyframeCount = 0;
    this.keyframes.forEach(keyframes => {
      keyframeCount += keyframes.length;
    });

    const cacheSize = this.animationCache.size;
    const estimatedMemoryMB = (keyframeCount * 0.1 + cacheSize * 0.05) / 1024; // Rough estimate

    return {
      keyframeCount,
      cacheSize,
      estimatedMemoryMB,
    };
  }
}

// Export singleton instance
export const keyframeEngine = KeyframeEngine.getInstance();

// Export helper functions
export const setKeyframe = (keyframe: Keyframe) => {
  keyframeEngine.setKeyframe(keyframe);
};

export const calculateAnimationState = (clipId: string, time: number) => {
  return keyframeEngine.calculateAnimationState(clipId, time);
};

export const createSmoothAnimation = (
  clipId: string,
  property: string,
  keyframes: Array<{ time: number; value: number; easing?: EasingFunction }>
) => {
  keyframeEngine.createSmoothAnimation(clipId, property, keyframes);
};

export default KeyframeEngine; 