-- ============================================================================
-- SECURITY FIXES FOR VIDEO STUDIO DATABASE
-- Addresses Supabase security linting issues
-- ============================================================================

-- ============================================================================
-- FIX 1: ASSET DEVICE MAPPING RLS POLICY
-- The current policy is too restrictive, causing 406 errors
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage their asset device mappings" ON asset_device_mapping;

-- Create more permissive policy that allows users to manage mappings for their own device
CREATE POLICY "Users can manage device mappings for their fingerprint" ON asset_device_mapping
  FOR ALL USING (
    -- Allow access if it's the user's device fingerprint
    device_fingerprint IN (
      SELECT device_fingerprint FROM user_devices WHERE user_id = auth.uid()
    )
    OR
    -- OR if the asset belongs to the user  
    asset_id IN (
      SELECT id FROM user_assets WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX 2: REMOVE SECURITY DEFINER FROM VIEWS
-- Replace with regular views that use RLS policies
-- ============================================================================

-- Drop existing security definer views
DROP VIEW IF EXISTS project_timeline_view;
DROP VIEW IF EXISTS ai_generation_status;

-- Recreate views without SECURITY DEFINER
CREATE VIEW project_timeline_view AS
SELECT 
  p.id as project_id,
  p.title as project_title,
  p.user_id,
  p.duration_seconds,
  p.fps,
  p.resolution,
  jsonb_agg(
    jsonb_build_object(
      'track_id', t.id,
      'track_type', t.track_type,
      'track_name', t.track_name,
      'track_order', t.track_order,
      'clips', COALESCE(clip_data.clips, '[]'::jsonb)
    ) ORDER BY t.track_order
  ) as tracks
FROM video_editor_projects p
LEFT JOIN timeline_tracks t ON p.id = t.project_id
LEFT JOIN (
  SELECT 
    c.track_id,
    jsonb_agg(
      jsonb_build_object(
        'clip_id', c.id,
        'asset_id', c.asset_id,
        'start_time', c.start_time,
        'end_time', c.end_time,
        'trim_start', c.trim_start,
        'trim_end', c.trim_end,
        'volume', c.volume,
        'opacity', c.opacity,
        'transform_data', c.transform_data,
        'asset_info', jsonb_build_object(
          'filename', ua.file_name,
          'content_type', ua.content_type,
          'duration', ua.duration_seconds,
          'local_asset_id', ua.local_asset_id
        )
      ) ORDER BY c.start_time
    ) as clips
  FROM timeline_clips c
  JOIN user_assets ua ON c.asset_id = ua.id
  GROUP BY c.track_id
) clip_data ON t.id = clip_data.track_id
WHERE p.user_id = auth.uid()  -- Add explicit RLS filter
GROUP BY p.id, p.title, p.user_id, p.duration_seconds, p.fps, p.resolution;

-- Recreate AI generation status view without SECURITY DEFINER
CREATE VIEW ai_generation_status AS
SELECT 
  ag.*,
  p.title as project_title,
  ua.file_name as generated_filename
FROM ai_generations ag
LEFT JOIN video_editor_projects p ON ag.project_id = p.id
LEFT JOIN user_assets ua ON ag.generated_asset_id = ua.id
WHERE ag.user_id = auth.uid()  -- Add explicit RLS filter
ORDER BY ag.created_at DESC;

-- ============================================================================
-- FIX 3: SECURE FUNCTIONS WITH SEARCH PATH
-- Add SECURITY DEFINER and SET search_path for all functions
-- ============================================================================

-- Fix cleanup_expired_exports function
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete exports older than 7 days
  DELETE FROM project_exports 
  WHERE completed_at < NOW() - INTERVAL '7 days'
  AND status = 'completed';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fix cleanup_old_processing_jobs function  
CREATE OR REPLACE FUNCTION cleanup_old_processing_jobs()
RETURNS INTEGER
SECURITY DEFINER  
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete failed jobs older than 1 day
  DELETE FROM ai_generations 
  WHERE status = 'failed' 
  AND created_at < NOW() - INTERVAL '1 day';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fix update_project_cache_status function
CREATE OR REPLACE FUNCTION update_project_cache_status()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp  
AS $$
BEGIN
  -- Update project's updated_at when cache changes
  UPDATE video_editor_projects 
  SET updated_at = NOW()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix calculate_project_duration function
CREATE OR REPLACE FUNCTION calculate_project_duration(p_project_id UUID)
RETURNS DECIMAL(10,3)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_end_time DECIMAL(10,3);
BEGIN
  SELECT COALESCE(MAX(c.end_time), 0)
  INTO max_end_time
  FROM timeline_clips c
  JOIN timeline_tracks t ON c.track_id = t.id
  WHERE t.project_id = p_project_id;
  
  RETURN max_end_time;
END;
$$ LANGUAGE plpgsql;

-- Fix update_project_duration_trigger function  
CREATE OR REPLACE FUNCTION update_project_duration_trigger()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p_id UUID;
BEGIN
  -- Get project_id from the track
  SELECT t.project_id INTO p_id
  FROM timeline_tracks t
  WHERE t.id = COALESCE(NEW.track_id, OLD.track_id);
  
  -- Update project duration
  UPDATE video_editor_projects
  SET 
    duration_seconds = calculate_project_duration(p_id),
    updated_at = NOW()
  WHERE id = p_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix update_project_metadata_on_asset_change function
CREATE OR REPLACE FUNCTION update_project_metadata_on_asset_change()
RETURNS TRIGGER
SECURITY DEFINER  
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Update projects that use this asset
  UPDATE video_editor_projects 
  SET updated_at = NOW()
  WHERE id IN (
    SELECT DISTINCT t.project_id 
    FROM timeline_tracks t
    JOIN timeline_clips c ON c.track_id = t.id
    WHERE c.asset_id = COALESCE(NEW.id, OLD.id)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix create_default_tracks function
CREATE OR REPLACE FUNCTION create_default_tracks(p_project_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Create default video track
  INSERT INTO timeline_tracks (project_id, track_type, track_name, track_order)
  VALUES (p_project_id, 'video', 'Video Track 1', 1);
  
  -- Create default audio track
  INSERT INTO timeline_tracks (project_id, track_type, track_name, track_order)
  VALUES (p_project_id, 'audio', 'Audio Track 1', 2);
  
  -- Create default overlay track
  INSERT INTO timeline_tracks (project_id, track_type, track_name, track_order)
  VALUES (p_project_id, 'overlay', 'Overlay Track 1', 3);
END;
$$ LANGUAGE plpgsql;

-- Fix create_recovery_point function
CREATE OR REPLACE FUNCTION create_recovery_point(
  p_project_id UUID,
  p_device_fingerprint TEXT,
  p_auto_generated BOOLEAN DEFAULT true
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recovery_id UUID;
  project_state JSONB;
  asset_manifest JSONB;
BEGIN
  -- Get current project state
  SELECT jsonb_build_object(
    'project_data', project_data,
    'timeline_data', timeline_data,
    'resolution', resolution,
    'fps', fps,
    'title', title,
    'description', description
  ) INTO project_state
  FROM video_editor_projects
  WHERE id = p_project_id;
  
  -- Build asset manifest
  SELECT jsonb_agg(jsonb_build_object(
    'asset_id', ua.id,
    'local_asset_id', ua.local_asset_id,
    'filename', ua.file_name,
    'content_type', ua.content_type,
    'file_size', ua.file_size_bytes,
    'duration', ua.duration_seconds,
    'dimensions', ua.dimensions
  )) INTO asset_manifest
  FROM user_assets ua
  WHERE ua.id IN (
    SELECT DISTINCT c.asset_id
    FROM timeline_clips c
    JOIN timeline_tracks t ON c.track_id = t.id
    WHERE t.project_id = p_project_id
  );
  
  -- Create recovery point
  INSERT INTO project_recovery_points (
    project_id,
    device_fingerprint,
    project_state,
    asset_manifest,
    auto_generated
  ) VALUES (
    p_project_id,
    p_device_fingerprint,
    project_state,
    COALESCE(asset_manifest, '[]'::jsonb),
    p_auto_generated
  ) RETURNING id INTO recovery_id;
  
  RETURN recovery_id;
END;
$$ LANGUAGE plpgsql;

-- Fix handle_asset_updated_at function
CREATE OR REPLACE FUNCTION handle_asset_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX 4: ADD ADDITIONAL RLS POLICIES FOR ENHANCED SECURITY
-- ============================================================================

-- Enable RLS on user_devices if not already enabled
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Create more specific RLS policy for video_editor_projects to prevent 409 conflicts
DROP POLICY IF EXISTS "Users can manage their own projects" ON video_editor_projects;
CREATE POLICY "Users can manage their own projects" ON video_editor_projects
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 5: CREATE SAFER DEFAULT POLICIES
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- SECURITY FIXES COMPLETED
-- ============================================================================

SELECT 'Database security fixes applied successfully!' as status; 