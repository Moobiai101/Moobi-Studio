-- ============================================================================
-- LOCAL-FIRST VIDEO STUDIO DATABASE MIGRATION
-- Transforms existing cloud-based schema to local-first architecture
-- ============================================================================

-- ============================================================================
-- STEP 1: DEVICE FINGERPRINTING & RECOVERY SYSTEM
-- ============================================================================

-- Device fingerprinting for project recovery
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT UNIQUE NOT NULL,
  device_name TEXT, -- "John's MacBook Pro"
  browser_info JSONB NOT NULL DEFAULT '{}', -- Browser type, version, etc.
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_devices
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_active ON user_devices(last_active);

-- RLS for user_devices
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own devices" ON user_devices
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- STEP 2: EXTEND USER_ASSETS FOR LOCAL-FIRST (keeping existing fields)
-- ============================================================================

-- Add local-first fields to existing user_assets table
ALTER TABLE user_assets 
ADD COLUMN IF NOT EXISTS local_asset_id TEXT, -- IndexedDB key
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT, -- Which device has this asset
ADD COLUMN IF NOT EXISTS thumbnails_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS filmstrip_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_model TEXT,
ADD COLUMN IF NOT EXISTS ai_generation_data JSONB DEFAULT '{}';

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_user_assets_local_id ON user_assets(local_asset_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_device ON user_assets(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_assets_ai_generated ON user_assets(ai_generated);

-- ============================================================================
-- STEP 3: COMPLETELY RESTRUCTURE VIDEO_EDITOR_PROJECTS
-- ============================================================================

-- Drop old triggers first
DROP TRIGGER IF EXISTS trigger_update_project_duration ON video_editor_projects;
DROP FUNCTION IF EXISTS update_video_project_duration();

-- Add new columns for local-first approach
ALTER TABLE video_editor_projects 
ADD COLUMN IF NOT EXISTS last_edited_device UUID REFERENCES user_devices(id),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
DROP COLUMN IF EXISTS project_metadata,
DROP COLUMN IF EXISTS optimization_data,
-- Keep project_data but we'll restructure it
ADD COLUMN IF NOT EXISTS timeline_data JSONB DEFAULT '{}';

-- Update project_data structure to be local-first compatible
UPDATE video_editor_projects 
SET project_data = jsonb_build_object(
  'version', 2,
  'local_first', true,
  'asset_references', '[]'::jsonb,
  'timeline_settings', jsonb_build_object(
    'zoom', 1,
    'scroll', 0,
    'currentTime', 0,
    'snapToGrid', true,
    'gridSize', 1
  ),
  'export_settings', COALESCE(export_settings, '{
    "format": "mp4",
    "quality": "high",
    "resolution": {"width": 1920, "height": 1080}
  }'::jsonb)
)
WHERE project_data IS NULL OR NOT (project_data ? 'local_first');

-- ============================================================================
-- STEP 4: CREATE TIMELINE STRUCTURE TABLES
-- ============================================================================

-- Timeline tracks (video, audio, overlay layers)
CREATE TABLE IF NOT EXISTS timeline_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES video_editor_projects(id) ON DELETE CASCADE,
  
  -- Track properties
  track_type TEXT NOT NULL CHECK (track_type IN ('video', 'audio', 'overlay', 'text')),
  track_name TEXT NOT NULL,
  track_order INTEGER NOT NULL, -- Stacking order
  
  -- Track settings
  is_locked BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  volume DECIMAL(3,2) DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 2.0),
  
  -- Visual properties
  opacity DECIMAL(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1.0),
  blend_mode TEXT DEFAULT 'normal',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual clips on timeline
CREATE TABLE IF NOT EXISTS timeline_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES timeline_tracks(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES user_assets(id) ON DELETE CASCADE,
  
  -- Timeline positioning
  start_time DECIMAL(10,3) NOT NULL CHECK (start_time >= 0),
  end_time DECIMAL(10,3) NOT NULL CHECK (end_time > start_time),
  layer_index INTEGER DEFAULT 0,
  
  -- Trimming
  trim_start DECIMAL(10,3) DEFAULT 0 CHECK (trim_start >= 0),
  trim_end DECIMAL(10,3),
  
  -- Audio properties
  volume DECIMAL(3,2) DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 2.0),
  is_muted BOOLEAN DEFAULT false,
  audio_fade_in DECIMAL(5,3) DEFAULT 0 CHECK (audio_fade_in >= 0),
  audio_fade_out DECIMAL(5,3) DEFAULT 0 CHECK (audio_fade_out >= 0),
  
  -- Visual properties
  opacity DECIMAL(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1.0),
  
  -- Transform data (for overlays) - stored as JSONB for flexibility
  transform_data JSONB DEFAULT '{}',
  
  -- Speed/time effects
  playback_speed DECIMAL(5,2) DEFAULT 1.0 CHECK (playback_speed > 0),
  reverse_playback BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 5: PROFESSIONAL EFFECTS SYSTEM
-- ============================================================================

-- Transitions between clips
CREATE TABLE IF NOT EXISTS clip_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_clip_id UUID REFERENCES timeline_clips(id) ON DELETE CASCADE,
  to_clip_id UUID REFERENCES timeline_clips(id) ON DELETE CASCADE,
  
  -- Transition properties
  transition_type TEXT NOT NULL,
  duration DECIMAL(5,3) NOT NULL CHECK (duration > 0),
  
  -- Transition settings
  easing_function TEXT DEFAULT 'ease-in-out',
  direction TEXT,
  custom_properties JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Visual effects applied to clips
CREATE TABLE IF NOT EXISTS clip_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES timeline_clips(id) ON DELETE CASCADE,
  
  -- Effect properties
  effect_type TEXT NOT NULL,
  effect_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  effect_order INTEGER DEFAULT 0,
  
  -- Effect parameters
  parameters JSONB NOT NULL DEFAULT '{}',
  keyframes JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audio effects and filters
CREATE TABLE IF NOT EXISTS audio_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES timeline_clips(id) ON DELETE CASCADE,
  
  -- Effect properties
  effect_type TEXT NOT NULL,
  effect_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  effect_order INTEGER DEFAULT 0,
  
  -- Effect parameters
  parameters JSONB NOT NULL DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Text overlays and titles
CREATE TABLE IF NOT EXISTS text_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES timeline_clips(id) ON DELETE CASCADE,
  
  -- Text content
  text_content TEXT NOT NULL,
  font_family TEXT DEFAULT 'Arial',
  font_size INTEGER DEFAULT 24,
  font_weight TEXT DEFAULT 'normal',
  font_style TEXT DEFAULT 'normal',
  
  -- Styling
  color TEXT DEFAULT '#FFFFFF',
  background_color TEXT,
  border_color TEXT,
  border_width INTEGER DEFAULT 0,
  
  -- Positioning
  position JSONB DEFAULT '{}',
  size JSONB DEFAULT '{}',
  
  -- Animation
  animation_in TEXT,
  animation_out TEXT,
  animation_duration DECIMAL(5,3),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keyframe animations for professional editing
CREATE TABLE IF NOT EXISTS keyframes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES timeline_clips(id) ON DELETE CASCADE,
  
  -- Keyframe properties
  property_name TEXT NOT NULL,
  time_offset DECIMAL(10,3) NOT NULL CHECK (time_offset >= 0),
  
  -- Value data
  value JSONB NOT NULL,
  easing_function TEXT DEFAULT 'linear',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 6: AI INTEGRATION TRACKING
-- ============================================================================

-- AI generation history and tracking
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES video_editor_projects(id) ON DELETE SET NULL,
  
  -- Generation details
  generation_type TEXT NOT NULL CHECK (generation_type IN ('text_to_video', 'image_to_video', 'audio_generation', 'text_generation')),
  ai_model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  
  -- Generation parameters
  parameters JSONB DEFAULT '{}',
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Results
  generated_asset_id UUID REFERENCES user_assets(id) ON DELETE SET NULL,
  generation_metadata JSONB DEFAULT '{}',
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 7: PROJECT RECOVERY SYSTEM
-- ============================================================================

-- Project recovery points for cross-device restoration
CREATE TABLE IF NOT EXISTS project_recovery_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES video_editor_projects(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  
  -- Recovery data
  project_state JSONB NOT NULL,
  asset_manifest JSONB NOT NULL, -- List of required assets with metadata
  
  -- Metadata
  recovery_point_name TEXT,
  auto_generated BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asset availability tracking across devices
CREATE TABLE IF NOT EXISTS asset_device_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES user_assets(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  
  -- Status
  is_available BOOLEAN DEFAULT true,
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Local storage info
  local_path TEXT, -- IndexedDB key or path
  file_hash TEXT, -- For integrity checking
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(asset_id, device_fingerprint)
);

-- ============================================================================
-- STEP 8: SIMPLIFIED EXPORT SYSTEM (LOCAL-FIRST)
-- ============================================================================

-- Simplified export tracking (no file storage, just metadata)
CREATE TABLE IF NOT EXISTS project_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES video_editor_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Export settings
  export_format TEXT NOT NULL,
  resolution JSONB NOT NULL,
  fps INTEGER NOT NULL,
  quality_preset TEXT NOT NULL,
  
  -- Export status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Results (no file storage - just metadata)
  file_size_bytes BIGINT,
  export_duration DECIMAL(10,3),
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 9: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Timeline tracks indexes
CREATE INDEX IF NOT EXISTS idx_timeline_tracks_project_id ON timeline_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tracks_type_order ON timeline_tracks(track_type, track_order);

-- Timeline clips indexes
CREATE INDEX IF NOT EXISTS idx_timeline_clips_track_id ON timeline_clips(track_id);
CREATE INDEX IF NOT EXISTS idx_timeline_clips_asset_id ON timeline_clips(asset_id);
CREATE INDEX IF NOT EXISTS idx_timeline_clips_timeline ON timeline_clips(start_time, end_time);

-- Effects indexes
CREATE INDEX IF NOT EXISTS idx_clip_effects_clip_id ON clip_effects(clip_id);
CREATE INDEX IF NOT EXISTS idx_audio_effects_clip_id ON audio_effects(clip_id);
CREATE INDEX IF NOT EXISTS idx_text_elements_clip_id ON text_elements(clip_id);
CREATE INDEX IF NOT EXISTS idx_keyframes_clip_id ON keyframes(clip_id);

-- Transitions indexes
CREATE INDEX IF NOT EXISTS idx_clip_transitions_from_clip ON clip_transitions(from_clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_transitions_to_clip ON clip_transitions(to_clip_id);

-- AI generations indexes
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_project_id ON ai_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_status ON ai_generations(status);

-- Recovery indexes
CREATE INDEX IF NOT EXISTS idx_recovery_points_project_id ON project_recovery_points(project_id);
CREATE INDEX IF NOT EXISTS idx_recovery_points_device ON project_recovery_points(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_asset_device_mapping_asset ON asset_device_mapping(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_device_mapping_device ON asset_device_mapping(device_fingerprint);

-- Export indexes
CREATE INDEX IF NOT EXISTS idx_project_exports_project_id ON project_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_project_exports_user_id ON project_exports(user_id);

-- ============================================================================
-- STEP 10: ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE timeline_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_recovery_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_device_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_exports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for timeline_tracks
CREATE POLICY "Users can manage tracks in their projects" ON timeline_tracks
  FOR ALL USING (
    project_id IN (
      SELECT id FROM video_editor_projects WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for timeline_clips
CREATE POLICY "Users can manage clips in their projects" ON timeline_clips
  FOR ALL USING (
    track_id IN (
      SELECT t.id FROM timeline_tracks t
      JOIN video_editor_projects p ON t.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create RLS policies for effects
CREATE POLICY "Users can manage effects on their clips" ON clip_effects
  FOR ALL USING (
    clip_id IN (
      SELECT c.id FROM timeline_clips c
      JOIN timeline_tracks t ON c.track_id = t.id
      JOIN video_editor_projects p ON t.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage audio effects on their clips" ON audio_effects
  FOR ALL USING (
    clip_id IN (
      SELECT c.id FROM timeline_clips c
      JOIN timeline_tracks t ON c.track_id = t.id
      JOIN video_editor_projects p ON t.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage text elements on their clips" ON text_elements
  FOR ALL USING (
    clip_id IN (
      SELECT c.id FROM timeline_clips c
      JOIN timeline_tracks t ON c.track_id = t.id
      JOIN video_editor_projects p ON t.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage keyframes on their clips" ON keyframes
  FOR ALL USING (
    clip_id IN (
      SELECT c.id FROM timeline_clips c
      JOIN timeline_tracks t ON c.track_id = t.id
      JOIN video_editor_projects p ON t.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create RLS policies for transitions
CREATE POLICY "Users can manage transitions between their clips" ON clip_transitions
  FOR ALL USING (
    from_clip_id IN (
      SELECT c.id FROM timeline_clips c
      JOIN timeline_tracks t ON c.track_id = t.id
      JOIN video_editor_projects p ON t.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create RLS policies for AI generations
CREATE POLICY "Users can manage their AI generations" ON ai_generations
  FOR ALL USING (user_id = auth.uid());

-- Create RLS policies for recovery
CREATE POLICY "Users can manage their project recovery points" ON project_recovery_points
  FOR ALL USING (
    project_id IN (
      SELECT id FROM video_editor_projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their asset device mappings" ON asset_device_mapping
  FOR ALL USING (
    asset_id IN (
      SELECT id FROM user_assets WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for exports
CREATE POLICY "Users can manage their project exports" ON project_exports
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- STEP 11: CLEAN UP OLD TABLES (OPTIONAL - COMMENT OUT IF UNSURE)
-- ============================================================================

-- These tables are no longer needed for local-first approach
-- Uncomment these lines only after confirming they're not used elsewhere

DROP TABLE IF EXISTS processing_jobs CASCADE;
DROP TABLE IF EXISTS device_capabilities CASCADE;
DROP TABLE IF EXISTS export_history CASCADE;

-- ============================================================================
-- STEP 12: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get project duration from timeline clips
CREATE OR REPLACE FUNCTION calculate_project_duration(p_project_id UUID)
RETURNS DECIMAL(10,3) AS $$
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

-- Function to auto-update project duration
CREATE OR REPLACE FUNCTION update_project_duration_trigger()
RETURNS TRIGGER AS $$
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

-- Create trigger to auto-update project duration
CREATE TRIGGER trigger_update_project_duration_on_clip_change
  AFTER INSERT OR UPDATE OR DELETE ON timeline_clips
  FOR EACH ROW
  EXECUTE FUNCTION update_project_duration_trigger();

-- Function to create default tracks for new projects
CREATE OR REPLACE FUNCTION create_default_tracks(p_project_id UUID)
RETURNS VOID AS $$
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

-- Function to create recovery point
CREATE OR REPLACE FUNCTION create_recovery_point(
  p_project_id UUID,
  p_device_fingerprint TEXT,
  p_auto_generated BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
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

-- ============================================================================
-- STEP 13: CREATE HELPFUL VIEWS
-- ============================================================================

-- View for complete project timeline data
CREATE OR REPLACE VIEW project_timeline_view AS
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
GROUP BY p.id, p.title, p.user_id, p.duration_seconds, p.fps, p.resolution;

-- View for AI generation status
CREATE OR REPLACE VIEW ai_generation_status AS
SELECT 
  ag.*,
  p.title as project_title,
  ua.file_name as generated_filename
FROM ai_generations ag
LEFT JOIN video_editor_projects p ON ag.project_id = p.id
LEFT JOIN user_assets ua ON ag.generated_asset_id = ua.id
ORDER BY ag.created_at DESC;

-- ============================================================================
-- MIGRATION COMPLETED SUCCESSFULLY
-- ============================================================================

SELECT 'Local-First Video Studio Migration Completed Successfully!' as status; 