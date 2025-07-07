import { createClient } from '@/lib/supabase/client';
import {
  UserDevice,
  UserDeviceInsert,
  UserDeviceUpdate,
  AssetDeviceMapping,
  AssetDeviceMappingInsert
} from '@/types/database';
import { deviceFingerprint } from '@/lib/device/device-fingerprint';

const supabase = createClient();

export class DeviceService {
  // ============================================================================
  // DEVICE REGISTRATION & MANAGEMENT
  // ============================================================================

  /**
   * Get browser information for device registration
   */
  static async getBrowserInfo(): Promise<{
    userAgent: string;
    platform: string;
    vendor: string;
    language: string;
    screenResolution: string;
    timezone: string;
    os: string;
    browser: string;
  }> {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor || 'unknown',
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      os: this.detectOS(),
      browser: this.detectBrowser()
    };
  }

  /**
   * Detect operating system
   */
  private static detectOS(): string {
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
  private static detectBrowser(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edg')) return 'Edge';
    if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
    
    return 'Unknown Browser';
  }

  /**
   * Register current device for user
   */
  static async registerDevice(deviceName?: string): Promise<UserDevice | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fingerprint = await deviceFingerprint.getFingerprint();
      const browserInfo = await this.getBrowserInfo();

      // Check if device already exists
      const { data: existingDevice } = await supabase
        .from('user_devices')
        .select('*')
        .eq('device_fingerprint', fingerprint)
        .eq('user_id', user.id)
        .single();

      if (existingDevice) {
        // Update existing device
        return await this.updateDevice(existingDevice.id, {
          device_name: deviceName || existingDevice.device_name,
          browser_info: browserInfo,
          last_active: new Date().toISOString()
        });
      }

      // Generate device name if not provided
      const autoDeviceName = deviceName || this.generateDeviceName(browserInfo);

      const deviceData: UserDeviceInsert = {
        user_id: user.id,
        device_fingerprint: fingerprint,
        device_name: autoDeviceName,
        browser_info: browserInfo,
        last_active: new Date().toISOString(),
        is_primary: await this.shouldSetAsPrimary(user.id)
      };

      const { data, error } = await supabase
        .from('user_devices')
        .insert(deviceData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error registering device:', error);
      return null;
    }
  }

  /**
   * Get current device information
   */
  static async getCurrentDevice(): Promise<UserDevice | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fingerprint = await deviceFingerprint.getFingerprint();

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('device_fingerprint', fingerprint)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting current device:', error);
      return null;
    }
  }

  /**
   * Get all user devices
   */
  static async getUserDevices(): Promise<UserDevice[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user devices:', error);
      return [];
    }
  }

  /**
   * Update device information
   */
  static async updateDevice(
    deviceId: string,
    updates: UserDeviceUpdate
  ): Promise<UserDevice | null> {
    try {
      const { data, error } = await supabase
        .from('user_devices')
        .update(updates)
        .eq('id', deviceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating device:', error);
      return null;
    }
  }

  /**
   * Update device activity timestamp
   */
  static async updateDeviceActivity(): Promise<void> {
    try {
      const currentDevice = await this.getCurrentDevice();
      if (!currentDevice) {
        // Register device if it doesn't exist
        await this.registerDevice();
        return;
      }

      await this.updateDevice(currentDevice.id, {
        last_active: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating device activity:', error);
    }
  }

  /**
   * Set device as primary
   */
  static async setPrimaryDevice(deviceId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Remove primary status from all devices
      await supabase
        .from('user_devices')
        .update({ is_primary: false })
        .eq('user_id', user.id);

      // Set new primary device
      const { error } = await supabase
        .from('user_devices')
        .update({ is_primary: true })
        .eq('id', deviceId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting primary device:', error);
      return false;
    }
  }

  /**
   * Remove device
   */
  static async removeDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing device:', error);
      return false;
    }
  }

  // ============================================================================
  // ASSET DEVICE MAPPING
  // ============================================================================

  /**
   * Mark asset as available on current device
   */
  static async markAssetAvailable(
    assetId: string,
    localPath: string,
    fileHash?: string
  ): Promise<boolean> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();

      const mappingData: AssetDeviceMappingInsert = {
        asset_id: assetId,
        device_fingerprint: fingerprint,
        is_available: true,
        local_path: localPath,
        file_hash: fileHash,
        last_verified: new Date().toISOString()
      };

      const { error } = await supabase
        .from('asset_device_mapping')
        .upsert(mappingData, {
          onConflict: 'asset_id,device_fingerprint'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking asset available:', error);
      return false;
    }
  }

  /**
   * Mark asset as unavailable on current device
   */
  static async markAssetUnavailable(assetId: string): Promise<boolean> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();

      const { error } = await supabase
        .from('asset_device_mapping')
        .update({
          is_available: false,
          last_verified: new Date().toISOString()
        })
        .eq('asset_id', assetId)
        .eq('device_fingerprint', fingerprint);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error marking asset unavailable:', error);
      return false;
    }
  }

  /**
   * Get asset availability across devices
   */
  static async getAssetAvailability(assetId: string): Promise<AssetDeviceMapping[]> {
    try {
      const { data, error } = await supabase
        .from('asset_device_mapping')
        .select('*')
        .eq('asset_id', assetId)
        .eq('is_available', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting asset availability:', error);
      return [];
    }
  }

  /**
   * Get all assets available on current device
   */
  static async getDeviceAssets(): Promise<AssetDeviceMapping[]> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();

      const { data, error } = await supabase
        .from('asset_device_mapping')
        .select('*')
        .eq('device_fingerprint', fingerprint)
        .eq('is_available', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting device assets:', error);
      return [];
    }
  }

  /**
   * Check if asset is available on current device
   */
  static async isAssetAvailable(assetId: string): Promise<boolean> {
    try {
      const fingerprint = await deviceFingerprint.getFingerprint();

      const { data, error } = await supabase
        .from('asset_device_mapping')
        .select('is_available')
        .eq('asset_id', assetId)
        .eq('device_fingerprint', fingerprint)
        .single();

      if (error) return false;
      return data?.is_available || false;
    } catch (error) {
      console.error('Error checking asset availability:', error);
      return false;
    }
  }

  /**
   * Clean up old device mappings
   */
  static async cleanupOldMappings(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase
        .from('asset_device_mapping')
        .delete()
        .lt('last_verified', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up old mappings:', error);
      return 0;
    }
  }

  // ============================================================================
  // DEVICE SYNC STATUS
  // ============================================================================

  /**
   * Get sync status for project across devices
   */
  static async getProjectSyncStatus(projectId: string): Promise<{
    totalDevices: number;
    syncedDevices: number;
    deviceStatus: Array<{
      device: UserDevice;
      lastSync: string | null;
      assetCount: number;
    }>;
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const devices = await this.getUserDevices();
      const deviceStatus = [];

      for (const device of devices) {
        // Get asset mappings for this device
        const { data: mappings } = await supabase
          .from('asset_device_mapping')
          .select('*')
          .eq('device_fingerprint', device.device_fingerprint)
          .eq('is_available', true);

        deviceStatus.push({
          device,
          lastSync: device.last_active,
          assetCount: mappings?.length || 0
        });
      }

      return {
        totalDevices: devices.length,
        syncedDevices: deviceStatus.filter(status => status.assetCount > 0).length,
        deviceStatus
      };
    } catch (error) {
      console.error('Error getting project sync status:', error);
      return {
        totalDevices: 0,
        syncedDevices: 0,
        deviceStatus: []
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Generate device name from browser info
   */
  private static generateDeviceName(browserInfo: any): string {
    const { os, browser } = browserInfo;
    const timestamp = new Date().toLocaleDateString();
    
    if (os && browser) {
      return `${browser} on ${os} (${timestamp})`;
    } else if (browser) {
      return `${browser} (${timestamp})`;
    } else {
      return `Device (${timestamp})`;
    }
  }

  /**
   * Check if this should be set as primary device
   */
  private static async shouldSetAsPrimary(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_devices')
        .select('id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .limit(1);

      if (error) return false;
      return !data || data.length === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get device statistics
   */
  static async getDeviceStats(): Promise<{
    totalDevices: number;
    activeDevices: number;
    primaryDevice: UserDevice | null;
    oldestDevice: string | null;
    newestDevice: string | null;
  }> {
    try {
      const devices = await this.getUserDevices();
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const activeDevices = devices.filter(device => 
        new Date(device.last_active) > oneWeekAgo
      );

      const primaryDevice = devices.find(device => device.is_primary);

      const sortedByDate = [...devices].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return {
        totalDevices: devices.length,
        activeDevices: activeDevices.length,
        primaryDevice: primaryDevice || null,
        oldestDevice: sortedByDate[0]?.created_at || null,
        newestDevice: sortedByDate[sortedByDate.length - 1]?.created_at || null
      };
    } catch (error) {
      console.error('Error getting device stats:', error);
      return {
        totalDevices: 0,
        activeDevices: 0,
        primaryDevice: null,
        oldestDevice: null,
        newestDevice: null
      };
    }
  }
} 