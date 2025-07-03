-- Migration: WebAssembly Enhancement for Video Studio
-- Adds support for: Export tracking, Processing jobs, Device capabilities, Enhanced metadata

-- 1. Add new columns to existing user_assets table
ALTER TABLE user_assets 
ADD COLUMN IF NOT EXISTS processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS optimization_flags JSONB DEFAULT '{}';

-- Update processing_metadata structure with proper defaults
UPDATE user_assets 
SET processing_metadata = '{
  "thumbnails_generated": false,
  "waveform_generated": false,
  "frames_extracted": false,
  "cache_keys": {}
}'::jsonb
WHERE processing_metadata = '{}'::jsonb OR processing_metadata IS NULL;

-- Update optimization_flags structure with proper defaults
UPDATE user_assets 
SET optimization_flags = '{
  "needs_transcoding": false,
  "recommended_quality": "medium",
  "webassembly_compatible": true,
  "estimated_processing_time": 0
}'::jsonb
WHERE optimization_flags = '{}'::jsonb OR optimization_flags IS NULL;

-- 2. Add new columns to existing video_editor_projects table
ALTER TABLE video_editor_projects 
ADD COLUMN IF NOT EXISTS project_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS optimization_data JSONB DEFAULT '{}';

-- Update project_metadata structure with proper defaults
UPDATE video_editor_projects 
SET project_metadata = '{
  "total_assets": 0,
  "processing_status": "ready",
  "webassembly_compatible": true,
  "cache_status": {
    "thumbnails_cached": 0,
    "waveforms_cached": 0,
    "frames_cached": 0
  },
  "collaboration": {
    "shared_with": [],
    "sync_status": "synced"
  }
}'::jsonb
WHERE project_metadata = '{}'::jsonb OR project_metadata IS NULL;

-- Update optimization_data structure with proper defaults
UPDATE video_editor_projects 
SET optimization_data = '{
  "complexity_score": 1,
  "recommended_settings": {
    "webassembly_enabled": true,
    "quality_preset": "medium",
    "worker_count": 2
  },
  "bottlenecks": []
}'::jsonb
WHERE optimization_data = '{}'::jsonb OR optimization_data IS NULL;

-- 3. Create export_history table (replaces R2 storage for exports)
CREATE TABLE IF NOT EXISTS export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES video_editor_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  export_settings JSONB NOT NULL DEFAULT '{}',
  export_status TEXT NOT NULL CHECK (export_status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  processing_time_seconds INTEGER DEFAULT NULL,
  file_size_bytes BIGINT DEFAULT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  error_message TEXT DEFAULT NULL,
  webassembly_used BOOLEAN NOT NULL DEFAULT false,
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for export_history
CREATE INDEX IF NOT EXISTS idx_export_history_project_id ON export_history(project_id);
CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_status ON export_history(export_status);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON export_history(created_at);
CREATE INDEX IF NOT EXISTS idx_export_history_expires_at ON export_history(expires_at);

-- 4. Create processing_jobs table for WebAssembly job queue
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES video_editor_projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES user_assets(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('thumbnail_generation', 'waveform_extraction', 'frame_extraction', 'effect_processing', 'export')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  job_data JSONB NOT NULL DEFAULT '{}',
  progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  estimated_completion TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  worker_id TEXT DEFAULT NULL,
  processing_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for processing_jobs
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON processing_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_asset_id ON processing_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_type ON processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_priority ON processing_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at);

-- Create compound index for job queue processing
CREATE INDEX IF NOT EXISTS idx_processing_jobs_queue ON processing_jobs(status, priority DESC, created_at) WHERE status = 'queued';

-- 5. Create device_capabilities table for performance optimization
CREATE TABLE IF NOT EXISTS device_capabilities (
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}',
  performance_profile JSONB NOT NULL DEFAULT '{}',
  browser_info JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);

-- Create indexes for device_capabilities
CREATE INDEX IF NOT EXISTS idx_device_capabilities_last_updated ON device_capabilities(last_updated);
CREATE INDEX IF NOT EXISTS idx_device_capabilities_created_at ON device_capabilities(created_at);

-- 6. Create functions for automatic cleanup

-- Function to clean up expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM export_history 
  WHERE expires_at < NOW() AND export_status IN ('completed', 'failed', 'cancelled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old processing jobs
CREATE OR REPLACE FUNCTION cleanup_old_processing_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processing_jobs 
  WHERE created_at < (NOW() - INTERVAL '7 days') 
  AND status IN ('completed', 'failed', 'cancelled');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update project metadata cache status
CREATE OR REPLACE FUNCTION update_project_cache_status(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
  thumb_count INTEGER;
  wave_count INTEGER;
  frame_count INTEGER;
BEGIN
  -- This function will be expanded when we implement actual caching
  -- For now, it's a placeholder for future WebAssembly implementation
  
  UPDATE video_editor_projects 
  SET project_metadata = jsonb_set(
    project_metadata,
    '{cache_status}',
    jsonb_build_object(
      'thumbnails_cached', 0,
      'waveforms_cached', 0,
      'frames_cached', 0,
      'last_updated', extract(epoch from now())
    )
  )
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Create Row Level Security (RLS) policies

-- Enable RLS on new tables
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_capabilities ENABLE ROW LEVEL SECURITY;

-- RLS policies for export_history
CREATE POLICY "Users can view their own export history" ON export_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own export history" ON export_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own export history" ON export_history
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own export history" ON export_history
  FOR DELETE USING (user_id = auth.uid());

-- RLS policies for processing_jobs
CREATE POLICY "Users can view their own processing jobs" ON processing_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own processing jobs" ON processing_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own processing jobs" ON processing_jobs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own processing jobs" ON processing_jobs
  FOR DELETE USING (user_id = auth.uid());

-- RLS policies for device_capabilities
CREATE POLICY "Users can view their own device capabilities" ON device_capabilities
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own device capabilities" ON device_capabilities
  FOR ALL USING (user_id = auth.uid());

-- 8. Create triggers for automatic updates

-- Trigger to update project metadata when assets change
CREATE OR REPLACE FUNCTION update_project_metadata_on_asset_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_assets count for projects that use this asset
  UPDATE video_editor_projects 
  SET project_metadata = jsonb_set(
    project_metadata,
    '{total_assets}',
    to_jsonb((
      SELECT COUNT(DISTINCT clip.assetId)
      FROM jsonb_array_elements(project_data->'clips') AS clip
      WHERE clip->>'assetId' IS NOT NULL
    ))
  )
  WHERE id IN (
    SELECT DISTINCT p.id
    FROM video_editor_projects p,
    jsonb_array_elements(p.project_data->'clips') AS clip
    WHERE clip->>'assetId' = COALESCE(NEW.id::text, OLD.id::text)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_assets
DROP TRIGGER IF EXISTS trigger_update_project_metadata_on_asset_change ON user_assets;
CREATE TRIGGER trigger_update_project_metadata_on_asset_change
  AFTER INSERT OR UPDATE OR DELETE ON user_assets
  FOR EACH ROW EXECUTE FUNCTION update_project_metadata_on_asset_change();

-- 9. Create helpful views

-- View for active processing jobs
CREATE OR REPLACE VIEW active_processing_jobs AS
SELECT 
  j.*,
  p.title as project_title,
  a.file_name as asset_name
FROM processing_jobs j
LEFT JOIN video_editor_projects p ON j.project_id = p.id
LEFT JOIN user_assets a ON j.asset_id = a.id
WHERE j.status IN ('queued', 'processing')
ORDER BY j.priority DESC, j.created_at ASC;

-- View for export statistics
CREATE OR REPLACE VIEW export_statistics AS
SELECT 
  user_id,
  COUNT(*) as total_exports,
  COUNT(*) FILTER (WHERE export_status = 'completed') as completed_exports,
  COUNT(*) FILTER (WHERE export_status = 'failed') as failed_exports,
  AVG(processing_time_seconds) FILTER (WHERE export_status = 'completed') as avg_processing_time,
  SUM(file_size_bytes) FILTER (WHERE export_status = 'completed') as total_exported_bytes,
  COUNT(*) FILTER (WHERE webassembly_used = true) as webassembly_exports
FROM export_history
GROUP BY user_id;

-- 10. Insert default values for existing data

-- Add default WebAssembly settings to existing projects
UPDATE video_editor_projects 
SET project_data = jsonb_set(
  project_data,
  '{webassembly_settings}',
  '{
    "enabled": true,
    "processing_quality": "medium",
    "use_simd": false,
    "worker_threads": 2,
    "memory_limit_mb": 512,
    "cache_strategy": "balanced"
  }'::jsonb
)
WHERE project_data->'webassembly_settings' IS NULL;

-- Add performance data to existing projects
UPDATE video_editor_projects 
SET project_data = jsonb_set(
  project_data,
  '{performance_data}',
  '{
    "cache_hit_rate": 0,
    "memory_usage": 0
  }'::jsonb
)
WHERE project_data->'performance_data' IS NULL;

-- Set processing status for existing assets
UPDATE user_assets 
SET processing_status = 'completed'
WHERE processing_status IS NULL;

-- 11. Comments for documentation
COMMENT ON TABLE export_history IS 'Tracks video export jobs without storing files in R2 - files are streamed as downloads';
COMMENT ON TABLE processing_jobs IS 'Queue for WebAssembly processing tasks (thumbnails, waveforms, effects)';
COMMENT ON TABLE device_capabilities IS 'Stores device performance data for adaptive quality settings';

COMMENT ON COLUMN export_history.expires_at IS 'When the download link expires (24 hours from creation)';
COMMENT ON COLUMN processing_jobs.priority IS 'Job priority (1-10, higher is more urgent)';
COMMENT ON COLUMN device_capabilities.device_id IS 'Unique identifier for user device combination';

-- Migration completed successfully
SELECT 'WebAssembly Enhancement Migration Completed Successfully' as status; 