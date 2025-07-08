-- ============================================================================
-- SIMPLIFIED USER-ONLY DATABASE SCHEMA
-- Removes device tracking complexity and uses only user authentication
-- ============================================================================

-- ============================================================================
-- FIX 1: REMOVE DEVICE CONSTRAINTS FROM VIDEO_EDITOR_PROJECTS
-- ============================================================================

-- Drop the foreign key constraint that's causing the 409 errors
ALTER TABLE video_editor_projects 
DROP CONSTRAINT IF EXISTS video_editor_projects_last_edited_device_fkey;

-- Make the device field nullable (or remove it entirely)
ALTER TABLE video_editor_projects 
ALTER COLUMN last_edited_device_fkey DROP NOT NULL;

-- Or better yet, remove the device tracking columns entirely
-- ALTER TABLE video_editor_projects DROP COLUMN IF EXISTS last_edited_device_fkey;
-- ALTER TABLE video_editor_projects DROP COLUMN IF EXISTS device_fingerprint;

-- ============================================================================
-- FIX 2: SIMPLIFY ASSET DEVICE MAPPING TO USER-ONLY
-- ============================================================================

-- Drop the complex asset_device_mapping table entirely
DROP TABLE IF EXISTS asset_device_mapping CASCADE;

-- Add a simple local storage flag to user_assets instead
ALTER TABLE user_assets 
ADD COLUMN IF NOT EXISTS is_local_available boolean DEFAULT false;

ALTER TABLE user_assets 
ADD COLUMN IF NOT EXISTS local_storage_key text;

-- ============================================================================
-- FIX 3: SIMPLIFIED RLS POLICIES (USER-BASED ONLY)
-- ============================================================================

-- Video Editor Projects - Simple user-based RLS
DROP POLICY IF EXISTS "Users can manage their video projects" ON video_editor_projects;

CREATE POLICY "Users can manage their video projects"
  ON video_editor_projects
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User Assets - Simple user-based RLS  
DROP POLICY IF EXISTS "Allow user asset management" ON user_assets;

CREATE POLICY "Users can manage their assets"
  ON user_assets
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 4: DROP DEVICE-RELATED TABLES (OPTIONAL)
-- ============================================================================

-- Since we're not using device tracking anymore, we can drop these tables
-- DROP TABLE IF EXISTS user_devices CASCADE;
-- Note: Keeping user_devices table for now in case it's used elsewhere

-- ============================================================================
-- FIX 5: ADD PERFORMANCE INDEXES FOR USER-BASED QUERIES
-- ============================================================================

-- Index for fast user asset lookups
CREATE INDEX IF NOT EXISTS idx_user_assets_user_id 
  ON user_assets(user_id);

-- Index for fast user project lookups  
CREATE INDEX IF NOT EXISTS idx_video_editor_projects_user_id 
  ON video_editor_projects(user_id);

-- ============================================================================
-- FIX 6: GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON video_editor_projects TO authenticated;
GRANT ALL ON user_assets TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- These should work without errors after migration:
-- SELECT COUNT(*) FROM video_editor_projects; 
-- SELECT COUNT(*) FROM user_assets;
-- INSERT INTO video_editor_projects (user_id, project_name) VALUES (auth.uid(), 'Test Project');

-- ============================================================================
-- SUMMARY 
-- ============================================================================

-- This migration:
-- ✅ Removes device foreign key constraints causing 409 errors
-- ✅ Simplifies to user-ID only approach  
-- ✅ Eliminates complex device registration requirements
-- ✅ Uses simple boolean flags for local storage tracking
-- ✅ Provides clean, fast user-based RLS policies
-- ✅ Much easier to maintain and understand 