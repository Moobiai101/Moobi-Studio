// Professional Audio Engine for Video Editing
// Inspired by Remotion's audio system and professional DAW practices

interface AudioTrack {
  id: string;
  audioElement: HTMLAudioElement;
  volume: number;
  muted: boolean;
  startTime: number;
  endTime: number;
  trimStart: number;
  trimEnd: number;
  src: string;
}

interface MasterAudioState {
  volume: number;
  muted: boolean;
  tracks: Map<string, AudioTrack>;
}

class ProfessionalAudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private trackGainNodes: Map<string, GainNode> = new Map();
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private masterState: MasterAudioState = {
    volume: 1.0,
    muted: false,
    tracks: new Map()
  };
  
  // Professional logarithmic scaling (same as Pro Tools/Logic)
  private linearToLog(linear: number): number {
    if (linear === 0) return 0;
    // Use exponential curve for natural volume perception
    return Math.pow(linear, 2.5);
  }
  
  private logToLinear(log: number): number {
    if (log === 0) return 0;
    return Math.pow(log, 1 / 2.5);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Web Audio API for professional control
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
    } catch (error) {
      // Fallback to HTML5 audio
      this.audioContext = null;
      this.masterGainNode = null;
    }
  }

  // Resume audio context on user interaction (Chrome autoplay policy)
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        // Silent - don't spam console
      }
    }
  }

  // Add audio track (clip) to the engine
  addTrack(clipId: string, audioSrc: string, startTime: number, endTime: number, trimStart: number = 0, trimEnd?: number): void {
    try {
      // Skip if track already exists
      if (this.masterState.tracks.has(clipId)) {
        return;
      }

      const audioElement = new Audio();
      audioElement.preload = 'metadata';
      
      // Don't set crossOrigin for local files (causes CORS issues)
      if (!audioSrc.startsWith('blob:') && !audioSrc.startsWith('data:') && !audioSrc.startsWith('/') && !audioSrc.startsWith('./')) {
        audioElement.crossOrigin = 'anonymous';
      }
      
      audioElement.src = audioSrc;
      
      // Resume audio context on first track add (user interaction)
      this.resumeAudioContext();
      
      // Set up Web Audio API routing if available
      let gainNode: GainNode | null = null;
      if (this.audioContext && this.masterGainNode) {
        try {
          const source = this.audioContext.createMediaElementSource(audioElement);
          gainNode = this.audioContext.createGain();
          
          source.connect(gainNode);
          gainNode.connect(this.masterGainNode);
          
          this.trackGainNodes.set(clipId, gainNode);
        } catch (webAudioError) {
          // Silent fallback to HTML5 audio
        }
      }
      
      const track: AudioTrack = {
        id: clipId,
        audioElement,
        volume: 1.0,
        muted: false,
        startTime,
        endTime,
        trimStart,
        trimEnd: trimEnd || endTime,
        src: audioSrc
      };
      
      this.masterState.tracks.set(clipId, track);
      this.audioElements.set(clipId, audioElement);
      
      // Initial volume setup
      this.updateTrackVolume(clipId);
    } catch (error) {
      console.error(`❌ Failed to add audio track ${clipId}:`, error);
    }
  }

  // Remove audio track
  removeTrack(clipId: string): void {
    const track = this.masterState.tracks.get(clipId);
    if (track) {
      track.audioElement.pause();
      track.audioElement.src = '';
      
      // Clean up Web Audio API nodes
      const gainNode = this.trackGainNodes.get(clipId);
      if (gainNode) {
        gainNode.disconnect();
        this.trackGainNodes.delete(clipId);
      }
      
      this.masterState.tracks.delete(clipId);
      this.audioElements.delete(clipId);
    }
  }

  // Set master volume with professional scaling
  setMasterVolume(volume: number): void {
    this.masterState.volume = Math.max(0, Math.min(1, volume));
    
          if (this.masterGainNode && this.audioContext) {
        try {
          // Apply logarithmic scaling for professional feel
          const audioVolume = this.masterState.muted ? 0 : this.linearToLog(this.masterState.volume);
          this.masterGainNode.gain.setValueAtTime(audioVolume, this.audioContext.currentTime);
        } catch (error) {
          this.updateAllTrackVolumes();
        }
      } else {
        // Fallback for HTML5 audio
        this.updateAllTrackVolumes();
      }
  }

  // Set master mute
  setMasterMuted(muted: boolean): void {
    this.masterState.muted = muted;
    
          if (this.masterGainNode && this.audioContext) {
        try {
          const audioVolume = muted ? 0 : this.linearToLog(this.masterState.volume);
          this.masterGainNode.gain.setValueAtTime(audioVolume, this.audioContext.currentTime);
        } catch (error) {
          this.updateAllTrackVolumes();
        }
      } else {
        this.updateAllTrackVolumes();
      }
  }

  // Set individual track volume
  setTrackVolume(clipId: string, volume: number): void {
    const track = this.masterState.tracks.get(clipId);
    if (!track) {
      console.warn(`⚠️ Track ${clipId} not found for volume change`);
      return;
    }
    
    track.volume = Math.max(0, Math.min(1, volume));
    
    const gainNode = this.trackGainNodes.get(clipId);
          if (gainNode && this.audioContext) {
        try {
          const effectiveVolume = (this.masterState.muted || track.muted) ? 0 : this.linearToLog(track.volume);
          gainNode.gain.setValueAtTime(effectiveVolume, this.audioContext.currentTime);
        } catch (error) {
          this.updateTrackVolume(clipId);
        }
      } else {
        // Fallback for HTML5 audio
        this.updateTrackVolume(clipId);
      }
  }

  // Set individual track mute
  setTrackMuted(clipId: string, muted: boolean): void {
    const track = this.masterState.tracks.get(clipId);
    if (!track) {
      console.warn(`⚠️ Track ${clipId} not found for mute change`);
      return;
    }
    
    track.muted = muted;
    
    const gainNode = this.trackGainNodes.get(clipId);
          if (gainNode && this.audioContext) {
        try {
          const effectiveVolume = (this.masterState.muted || muted) ? 0 : this.linearToLog(track.volume);
          gainNode.gain.setValueAtTime(effectiveVolume, this.audioContext.currentTime);
        } catch (error) {
          this.updateTrackVolume(clipId);
        }
      } else {
        this.updateTrackVolume(clipId);
      }
  }

  // Debug method to check audio engine status
  getDebugInfo() {
    return {
      hasAudioContext: !!this.audioContext,
      audioContextState: this.audioContext?.state,
      hasMasterGain: !!this.masterGainNode,
      tracksCount: this.masterState.tracks.size,
      trackIds: Array.from(this.masterState.tracks.keys()),
      masterVolume: this.masterState.volume,
      masterMuted: this.masterState.muted
    };
  }

  // Update track volumes (fallback for HTML5 audio)
  private updateTrackVolume(clipId: string): void {
    const track = this.masterState.tracks.get(clipId);
    if (!track) {
      return;
    }
    
    try {
      const effectiveVolume = (this.masterState.muted || track.muted) ? 0 : 
        this.linearToLog(this.masterState.volume) * this.linearToLog(track.volume);
      
      track.audioElement.volume = Math.max(0, Math.min(1, effectiveVolume));
      track.audioElement.muted = this.masterState.muted || track.muted;
    } catch (error) {
      // Silent - don't log frequent volume updates
    }
  }

  private updateAllTrackVolumes(): void {
    for (const [clipId] of this.masterState.tracks) {
      this.updateTrackVolume(clipId);
    }
  }

  // Sync playback to timeline position (optimized for smooth playback)
  syncToTimeline(currentTime: number, isPlaying: boolean): void {
    // Resume audio context if needed (user interaction)
    if (isPlaying) {
      this.resumeAudioContext();
    }

    for (const [clipId, track] of this.masterState.tracks) {
      const isInRange = currentTime >= track.startTime && currentTime <= track.endTime;
      
      if (isInRange && isPlaying) {
        // Calculate position within the clip including trim
        const clipProgress = (currentTime - track.startTime) / (track.endTime - track.startTime);
        const trimmedDuration = track.trimEnd - track.trimStart;
        const audioTime = track.trimStart + (clipProgress * trimmedDuration);
        
        // Only sync if there's a significant drift (increased tolerance to prevent flickering)
        const timeDiff = Math.abs(track.audioElement.currentTime - audioTime);
        if (timeDiff > 0.2) { // 200ms tolerance to prevent constant syncing
          try {
            track.audioElement.currentTime = audioTime;
          } catch (error) {
            // Silent - don't log frequent sync errors
          }
        }
        
        // Only start playback if paused
        if (track.audioElement.paused) {
          track.audioElement.play().catch(() => {
            // Silent - don't log every play attempt
          });
        }
      } else {
        // Only pause if playing
        if (!track.audioElement.paused) {
          track.audioElement.pause();
        }
      }
    }
  }

  // Get current state for UI
  getMasterState() {
    return {
      volume: this.masterState.volume,
      muted: this.masterState.muted,
      effectiveVolume: this.masterState.muted ? 0 : this.linearToLog(this.masterState.volume)
    };
  }

  getTrackState(clipId: string) {
    const track = this.masterState.tracks.get(clipId);
    if (!track) return null;
    
    return {
      volume: track.volume,
      muted: track.muted,
      effectiveVolume: (this.masterState.muted || track.muted) ? 0 : this.linearToLog(track.volume)
    };
  }

  // Cleanup
  destroy(): void {
    for (const [clipId] of this.masterState.tracks) {
      this.removeTrack(clipId);
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Singleton instance
export const audioEngine = new ProfessionalAudioEngine();

// Initialize on first import
audioEngine.initialize().then(() => {
  console.log('🎚️ Professional Audio Engine ready');
}).catch(error => {
  console.error('❌ Audio Engine initialization failed:', error);
}); 