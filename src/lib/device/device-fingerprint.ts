import { createClient } from '@/lib/supabase/client';

/**
 * Professional device fingerprinting for project recovery
 * Creates a stable identifier for the user's device/browser combination
 */
export class DeviceFingerprint {
  private static instance: DeviceFingerprint;
  private fingerprint: string | null = null;
  private deviceId: string | null = null;
  
  private constructor() {}
  
  static getInstance(): DeviceFingerprint {
    if (!DeviceFingerprint.instance) {
      DeviceFingerprint.instance = new DeviceFingerprint();
    }
    return DeviceFingerprint.instance;
  }
  
  /**
   * Generate a stable device fingerprint
   * Combines multiple browser characteristics for uniqueness
   */
  async generateFingerprint(): Promise<string> {
    if (this.fingerprint) return this.fingerprint;
    
    const components: string[] = [];
    
    // 1. Canvas fingerprinting
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Text with multiple styles
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        
        ctx.fillStyle = '#069';
        ctx.font = '11pt Arial';
        ctx.fillText('Canvas fingerprint Ѽ∞', 2, 15);
        
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.font = '18pt Arial';
        ctx.fillText('🎬 Creative Suite', 4, 45);
        
        components.push(canvas.toDataURL());
      }
    } catch (e) {
      components.push('canvas-blocked');
    }
    
    // 2. WebGL fingerprinting
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (gl && gl instanceof WebGLRenderingContext) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
          components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
      }
    } catch (e) {
      components.push('webgl-blocked');
    }
    
    // 3. Screen properties
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(`${screen.availWidth}x${screen.availHeight}`);
    components.push(`${window.devicePixelRatio || 1}`);
    
    // 4. Timezone and language
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
    components.push(navigator.language);
    components.push(navigator.languages.join(','));
    
    // 5. Platform info
    components.push(navigator.platform);
    components.push(navigator.hardwareConcurrency?.toString() || 'unknown');
    
    // 6. User agent (truncated for stability)
    components.push(navigator.userAgent.substring(0, 100));
    
    // 7. Audio context fingerprinting
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const analyser = context.createAnalyser();
      const gain = context.createGain();
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      
      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;
      gain.gain.value = 0;
      
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gain);
      gain.connect(context.destination);
      
      oscillator.start(0);
      oscillator.stop(0.1);
      
      components.push(`audio:${context.sampleRate}`);
      
      scriptProcessor.disconnect();
      gain.disconnect();
      analyser.disconnect();
      oscillator.disconnect();
      context.close();
    } catch (e) {
      components.push('audio-blocked');
    }
    
    // 8. Font detection (common professional fonts)
    const fonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS',
      'Arial Black', 'Impact', 'Lucida Console', 'Tahoma', 'Calibri'
    ];
    
    const detectedFonts = fonts.filter(font => this.detectFont(font));
    components.push(detectedFonts.join(','));
    
    // Create hash from components
    const fingerprintString = components.join('|||');
    this.fingerprint = await this.hashString(fingerprintString);
    
    return this.fingerprint;
  }
  
  /**
   * Detect if a font is available
   */
  private detectFont(fontName: string): boolean {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return false;
    
    const text = 'mmmmmmmmmmlli';
    const font = '72px monospace';
    const fontTest = `72px ${fontName}, monospace`;
    
    context.font = font;
    const baselineSize = context.measureText(text).width;
    
    context.font = fontTest;
    const newSize = context.measureText(text).width;
    
    return baselineSize !== newSize;
  }
  
  /**
   * Hash the fingerprint components
   */
  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // Use first 32 chars for manageable length
  }
  
  /**
   * Register device with backend
   */
  async registerDevice(deviceName?: string): Promise<string> {
    const supabase = createClient();
    const fingerprint = await this.generateFingerprint();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    // Check if device already exists
    const { data: existingDevice } = await supabase
      .from('user_devices')
      .select('id')
      .eq('device_fingerprint', fingerprint)
      .single();
    
    if (existingDevice) {
      // Update last active
      await supabase
        .from('user_devices')
        .update({ last_active: new Date().toISOString() })
        .eq('id', existingDevice.id);
      
      this.deviceId = existingDevice.id;
      return existingDevice.id;
    }
    
    // Create new device record
    const browserInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    
    const { data: newDevice, error } = await supabase
      .from('user_devices')
      .insert({
        user_id: user.id,
        device_fingerprint: fingerprint,
        device_name: deviceName || this.generateDeviceName(),
        browser_info: browserInfo
      })
      .select()
      .single();
    
    if (error) throw error;
    
    this.deviceId = newDevice.id;
    return newDevice.id;
  }
  
  /**
   * Generate a friendly device name
   */
  private generateDeviceName(): string {
    const os = this.detectOS();
    const browser = this.detectBrowser();
    const date = new Date().toLocaleDateString();
    
    return `${os} - ${browser} (${date})`;
  }
  
  /**
   * Detect operating system
   */
  private detectOS(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Win')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    
    return 'Unknown OS';
  }
  
  /**
   * Detect browser
   */
  private detectBrowser(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edg')) return 'Edge';
    if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
    
    return 'Unknown Browser';
  }
  
  /**
   * Get current device fingerprint
   */
  async getFingerprint(): Promise<string> {
    if (!this.fingerprint) {
      this.fingerprint = await this.generateFingerprint();
    }
    return this.fingerprint;
  }
  
  /**
   * Get current device ID
   */
  getDeviceId(): string | null {
    return this.deviceId;
  }
  
  /**
   * Check storage persistence
   */
  async requestPersistence(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const isPersisted = await navigator.storage.persist();
      console.log(`Storage persistence: ${isPersisted ? 'Granted' : 'Denied'}`);
      return isPersisted;
    }
    return false;
  }
}

// Export singleton instance
export const deviceFingerprint = DeviceFingerprint.getInstance(); 