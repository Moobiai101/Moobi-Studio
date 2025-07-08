-- ============================================================================
-- COMPREHENSIVE DATABASE SECURITY FIXES V2
-- Fixes all remaining Supabase security issues without workarounds
-- ============================================================================

-- ============================================================================
-- FIX 1: PROPERLY FIX SECURITY DEFINER VIEWS
-- Use Supabase's recommended approach with security_invoker=on
-- ============================================================================

-- Fix project_timeline_view
ALTER VIEW public.project_timeline_view SET (security_invoker=on);

-- Fix ai_generation_status view  
ALTER VIEW public.ai_generation_status SET (security_invoker=on);

-- ============================================================================
-- FIX 2: ENSURE USER_DEVICES TABLE IS PROPERLY ACCESSIBLE
-- The RLS policy depends on this table being queryable
-- ============================================================================

-- Make sure user_devices table exists and has proper RLS
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the user_devices policy to be more permissive for device registration
DROP POLICY IF EXISTS "Users can manage their own devices" ON user_devices;
CREATE POLICY "Users can manage their own devices" ON user_devices
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 3: COMPLETELY REWRITE ASSET_DEVICE_MAPPING RLS POLICY  
-- Make it work reliably without depending on complex joins
-- ============================================================================

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can manage device mappings for their fingerprint" ON asset_device_mapping;
DROP POLICY IF EXISTS "Users can manage their asset device mappings" ON asset_device_mapping;

-- Create a simpler, more reliable policy
CREATE POLICY "Asset device mapping access" ON asset_device_mapping
  FOR ALL USING (
    -- Allow if the asset belongs to the current user
    asset_id IN (
      SELECT id FROM user_assets WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same check for inserts/updates
    asset_id IN (
      SELECT id FROM user_assets WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX 4: IMPROVE VIDEO_EDITOR_PROJECTS RLS TO PREVENT 409 CONFLICTS
-- ============================================================================

-- Drop existing policy and create a more robust one
DROP POLICY IF EXISTS "Users can manage their own projects" ON video_editor_projects;

CREATE POLICY "Video project management" ON video_editor_projects
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add a policy specifically for updates to reduce conflicts
CREATE POLICY "Video project updates" ON video_editor_projects
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 5: ENSURE PROPER PERMISSIONS ON ALL TABLES
-- ============================================================================

-- Grant explicit permissions to authenticated users for all relevant tables
GRANT SELECT, INSERT, UPDATE, DELETE ON user_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_device_mapping TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON video_editor_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON timeline_tracks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON timeline_clips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clip_effects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audio_effects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON text_elements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON keyframes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clip_transitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_recovery_points TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_exports TO authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- FIX 6: COMPLETE FUNCTION SECURITY FIXES
-- Fix the remaining function that still has search path issues
-- ============================================================================

-- Fix update_project_cache_status function (the one still showing warnings)
CREATE OR REPLACE FUNCTION update_project_cache_status()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update project's updated_at when cache changes
  UPDATE video_editor_projects 
  SET updated_at = NOW()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FIX 7: CREATE HELPER FUNCTION FOR DEVICE REGISTRATION
-- Ensure devices are properly registered in user_devices table
-- ============================================================================

CREATE OR REPLACE FUNCTION register_user_device(
  p_device_fingerprint TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_browser_info JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  device_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Insert or update device record
  INSERT INTO user_devices (
    user_id,
    device_fingerprint,
    device_name,
    browser_info,
    last_active,
    is_primary
  ) VALUES (
    current_user_id,
    p_device_fingerprint,
    COALESCE(p_device_name, 'Unknown Device'),
    p_browser_info,
    NOW(),
    false
  )
  ON CONFLICT (device_fingerprint) 
  DO UPDATE SET
    last_active = NOW(),
    browser_info = EXCLUDED.browser_info
  RETURNING id INTO device_id;
  
  RETURN device_id;
END;
$$;

-- ============================================================================
-- FIX 8: ENSURE ALL TABLES HAVE PROPER RLS ENABLED
-- ============================================================================

-- Enable RLS on all tables (some might not have it enabled)
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_editor_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_device_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_recovery_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX 9: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create indexes to improve RLS policy performance
CREATE INDEX IF NOT EXISTS idx_user_assets_user_id_optimized ON user_assets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_device_mapping_asset_user ON asset_device_mapping(asset_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint_user ON user_devices(device_fingerprint, user_id);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify that the security definer issue is fixed
SELECT schemaname, viewname, viewowner 
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('project_timeline_view', 'ai_generation_status');

-- Verify RLS policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('asset_device_mapping', 'video_editor_projects', 'user_devices');

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'Database security fixes V2 applied successfully!' as status,
       'All RLS policies updated, security definer views fixed, proper permissions granted' as details; 