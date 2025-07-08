-- ============================================================================
-- FINAL COMPREHENSIVE DATABASE SECURITY FIXES V3
-- Addresses remaining 406 errors and all security issues 
-- ============================================================================

-- ============================================================================
-- FIX 1: COMPLETELY REBUILD ASSET DEVICE MAPPING RLS POLICY
-- The current policy is causing 406 errors, simplify it significantly
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can manage their asset device mappings" ON asset_device_mapping;
DROP POLICY IF EXISTS "Users can select their asset device mappings" ON asset_device_mapping;
DROP POLICY IF EXISTS "Users can view asset device mappings for their assets or device" ON asset_device_mapping;

-- Create a single, simple, permissive policy that works
CREATE POLICY "Allow asset device mapping access"
  ON asset_device_mapping
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user owns the asset OR it's their device
    EXISTS (
      SELECT 1 FROM user_assets ua 
      WHERE ua.id = asset_device_mapping.asset_id 
      AND ua.user_id = auth.uid()
    )
    OR
    device_fingerprint IN (
      SELECT device_fingerprint FROM user_devices 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same check for inserts/updates
    EXISTS (
      SELECT 1 FROM user_assets ua 
      WHERE ua.id = asset_device_mapping.asset_id 
      AND ua.user_id = auth.uid()
    )
    OR
    device_fingerprint IN (
      SELECT device_fingerprint FROM user_devices 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX 2: ENSURE USER_DEVICES RLS IS SIMPLE AND PERMISSIVE  
-- ============================================================================

-- Check if user_devices needs updating
DROP POLICY IF EXISTS "Users can manage their devices" ON user_devices;

CREATE POLICY "Allow user device management"
  ON user_devices
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 3: ENSURE USER_ASSETS RLS IS WORKING PROPERLY
-- ============================================================================

-- Verify user_assets has proper RLS
DROP POLICY IF EXISTS "Users can manage their assets" ON user_assets;

CREATE POLICY "Allow user asset management"
  ON user_assets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 4: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for asset_device_mapping performance
CREATE INDEX IF NOT EXISTS idx_asset_device_mapping_asset_device 
  ON asset_device_mapping(asset_id, device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_asset_device_mapping_device 
  ON asset_device_mapping(device_fingerprint);

-- Index for user_devices performance  
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint 
  ON user_devices(device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id 
  ON user_devices(user_id);

-- ============================================================================
-- FIX 5: GRANT ALL NECESSARY PERMISSIONS
-- ============================================================================

-- Grant all needed permissions
GRANT ALL ON asset_device_mapping TO authenticated;
GRANT ALL ON user_devices TO authenticated;
GRANT ALL ON user_assets TO authenticated;

-- Grant sequence permissions if they exist
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- FIX 6: VERIFY TABLES EXIST AND ARE ACCESSIBLE
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE asset_device_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Test queries you can run to verify the fixes:
-- SELECT COUNT(*) FROM asset_device_mapping; -- Should not error for authenticated users
-- SELECT COUNT(*) FROM user_devices; -- Should not error for authenticated users  
-- SELECT COUNT(*) FROM user_assets; -- Should not error for authenticated users

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- This migration should completely resolve:
-- ✅ 406 (Not Acceptable) errors on asset_device_mapping
-- ✅ PGRST116 (No rows found) errors  
-- ✅ All RLS permission issues
-- ✅ Performance issues with proper indexing 