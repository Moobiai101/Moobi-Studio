-- ============================================================================
-- PRODUCTION-GRADE MIGRATION: Check and Fix Schema
-- This script safely checks current state and applies only necessary changes
-- ============================================================================

-- Start transaction for safety
BEGIN;

-- ============================================================================
-- STEP 1: Check Current Schema State
-- ============================================================================

DO $$
DECLARE
    has_device_fkey_column BOOLEAN;
    has_device_fkey_constraint BOOLEAN;
    has_asset_device_mapping BOOLEAN;
    has_local_storage_columns BOOLEAN;
BEGIN
    -- Check if last_edited_device_fkey column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'video_editor_projects' 
        AND column_name = 'last_edited_device_fkey'
    ) INTO has_device_fkey_column;

    -- Check if foreign key constraint exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'video_editor_projects_last_edited_device_fkey'
        AND table_name = 'video_editor_projects'
    ) INTO has_device_fkey_constraint;

    -- Check if asset_device_mapping table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'asset_device_mapping'
    ) INTO has_asset_device_mapping;

    -- Check if user_assets has local storage columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_assets' 
        AND column_name = 'is_local_available'
    ) INTO has_local_storage_columns;

    -- ============================================================================
    -- STEP 2: Apply Necessary Changes Based on Current State
    -- ============================================================================

    -- Add last_edited_device_fkey column if it doesn't exist
    IF NOT has_device_fkey_column THEN
        ALTER TABLE video_editor_projects 
        ADD COLUMN last_edited_device_fkey TEXT;
        RAISE NOTICE 'Added last_edited_device_fkey column';
    END IF;

    -- Drop foreign key constraint if it exists
    IF has_device_fkey_constraint THEN
        ALTER TABLE video_editor_projects 
        DROP CONSTRAINT video_editor_projects_last_edited_device_fkey;
        RAISE NOTICE 'Dropped device foreign key constraint';
    END IF;

    -- Make column nullable
    ALTER TABLE video_editor_projects 
    ALTER COLUMN last_edited_device_fkey DROP NOT NULL;
    RAISE NOTICE 'Made last_edited_device_fkey nullable';

    -- Drop asset_device_mapping if it exists
    IF has_asset_device_mapping THEN
        DROP TABLE asset_device_mapping CASCADE;
        RAISE NOTICE 'Dropped asset_device_mapping table';
    END IF;

    -- Add local storage columns to user_assets if they don't exist
    IF NOT has_local_storage_columns THEN
        ALTER TABLE user_assets 
        ADD COLUMN IF NOT EXISTS is_local_available BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS local_storage_key TEXT;
        RAISE NOTICE 'Added local storage columns to user_assets';
    END IF;

END $$;

-- ============================================================================
-- STEP 3: Update RLS Policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their video projects" ON video_editor_projects;
DROP POLICY IF EXISTS "Allow user asset management" ON user_assets;
DROP POLICY IF EXISTS "Users can manage their assets" ON user_assets;

-- Create simplified user-based policies
CREATE POLICY "Users can manage their video projects"
    ON video_editor_projects
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their assets"
    ON user_assets
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STEP 4: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_assets_user_id 
    ON user_assets(user_id);

CREATE INDEX IF NOT EXISTS idx_video_editor_projects_user_id 
    ON video_editor_projects(user_id);

-- ============================================================================
-- STEP 5: Grant Permissions
-- ============================================================================

GRANT ALL ON video_editor_projects TO authenticated;
GRANT ALL ON user_assets TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- STEP 6: Reload Schema Cache
-- ============================================================================

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Commit transaction
COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after migration)
-- ============================================================================

-- Check video_editor_projects columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'video_editor_projects' 
AND column_name LIKE '%device%';

-- Check if asset_device_mapping is gone
SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'asset_device_mapping'
) AS asset_device_mapping_removed;

-- Check user_assets columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_assets' 
AND column_name IN ('is_local_available', 'local_storage_key');

-- Test query (should work without errors)
-- SELECT COUNT(*) FROM video_editor_projects WHERE user_id = auth.uid(); 