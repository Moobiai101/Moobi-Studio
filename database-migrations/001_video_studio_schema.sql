-- Video Studio Production-Grade Database Schema
-- Designed for scalability, performance, and professional video editing features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- =====================================================
-- CORE VIDEO STUDIO TABLES
-- =====================================================

-- Video Studio Projects (Main project container)
CREATE TABLE video_studio_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic project info
    title TEXT NOT NULL DEFAULT 'Untitled Project',
    description TEXT,
    thumbnail_url TEXT, -- Base64 or URL to project thumbnail
    
    -- Video specifications
    resolution_width INTEGER NOT NULL DEFAULT 1920,
    resolution_height INTEGER NOT NULL DEFAULT 1080,
    fps DECIMAL(5,2) NOT NULL DEFAULT 30.0,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    duration_seconds DECIMAL(10,3) NOT NULL DEFAULT 0.0,
    
    -- Project status and metadata
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'editing', 'rendering', 'completed', 'archived')),
    version INTEGER NOT NULL DEFAULT 1,
    is_template BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT false,
    
    -- Collaboration and sharing
    collaborators JSONB DEFAULT '[]'::jsonb, -- Array of user IDs with permissions
    share_token TEXT UNIQUE, -- For public sharing
    
    -- Timeline state
    timeline_zoom DECIMAL(5,2) DEFAULT 1.0,
    timeline_scroll DECIMAL(10,2) DEFAULT 0.0,
    current_time DECIMAL(10,3) DEFAULT 0.0,
    
    -- Auto-save and backup
    auto_save_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_save_interval INTEGER NOT NULL DEFAULT 30, -- seconds
    last_auto_save TIMESTAMP WITH TIME ZONE,
    backup_count INTEGER NOT NULL DEFAULT 0,
    
    -- Export settings
    export_settings JSONB DEFAULT '{
        "format": "mp4",
        "quality": "high",
        "resolution": {"width": 1920, "height": 1080},
        "fps": 30,
        "bitrate": "auto"
    }'::jsonb,
    
    -- Performance tracking
    file_count INTEGER NOT NULL DEFAULT 0,
    total_file_size BIGINT NOT NULL DEFAULT 0,
    complexity_score INTEGER NOT NULL DEFAULT 0, -- For performance optimization
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Video Studio Media Assets (File metadata and fingerprints)
CREATE TABLE video_studio_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File identification (for IndexedDB linking)
    fingerprint TEXT NOT NULL, -- MD5/SHA-256 hash for file matching
    secondary_fingerprint TEXT, -- Backup fingerprint method
    original_filename TEXT NOT NULL,
    file_path TEXT, -- Last known file path for auto-recovery
    
    -- File metadata
    content_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    duration_seconds DECIMAL(10,3),
    
    -- Media dimensions and specs
    width INTEGER,
    height INTEGER,
    aspect_ratio TEXT,
    
    -- Video-specific metadata
    video_codec TEXT,
    audio_codec TEXT,
    bitrate_kbps INTEGER,
    fps DECIMAL(5,2),
    audio_channels INTEGER DEFAULT 2,
    audio_sample_rate INTEGER DEFAULT 44100,
    
    -- Processing status
    analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
    proxy_status TEXT DEFAULT 'pending' CHECK (proxy_status IN ('pending', 'processing', 'completed', 'failed')),
    thumbnail_status TEXT DEFAULT 'pending' CHECK (thumbnail_status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Analysis results (stored as metadata)
    scene_analysis JSONB, -- Scene detection, cuts, etc.
    audio_analysis JSONB, -- Volume levels, silence detection, etc.
    color_analysis JSONB, -- Color histograms, brightness, etc.
    
    -- Usage tracking
    usage_count INTEGER NOT NULL DEFAULT 0,
    projects_used_in TEXT[] DEFAULT ARRAY[]::TEXT[], -- Project IDs using this asset
    
    -- Cache keys for IndexedDB
    thumbnail_cache_key TEXT,
    filmstrip_cache_key TEXT,
    proxy_cache_keys JSONB DEFAULT '{}'::jsonb, -- Different quality levels
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, fingerprint),
    CONSTRAINT valid_media_type CHECK (content_type ~ '^(video|audio|image)/')
);

-- Video Studio Tracks (Timeline tracks)
CREATE TABLE video_studio_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES video_studio_projects(id) ON DELETE CASCADE,
    
    -- Track identification
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('video', 'audio', 'overlay', 'text', 'subtitle')),
    position INTEGER NOT NULL, -- Track order (0 = bottom)
    
    -- Visual properties
    height INTEGER NOT NULL DEFAULT 60, -- Track height in timeline
    color TEXT DEFAULT '#3b82f6', -- Track color for UI
    
    -- Track settings
    volume DECIMAL(3,2) DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 2.0),
    opacity DECIMAL(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1.0),
    muted BOOLEAN NOT NULL DEFAULT false,
    solo BOOLEAN NOT NULL DEFAULT false,
    locked BOOLEAN NOT NULL DEFAULT false,
    visible BOOLEAN NOT NULL DEFAULT true,
    
    -- Advanced properties for overlay tracks
    blend_mode TEXT DEFAULT 'normal' CHECK (blend_mode IN (
        'normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
        'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion'
    )),
    
    -- Audio-specific settings
    pan DECIMAL(3,2) DEFAULT 0.0 CHECK (pan >= -1.0 AND pan <= 1.0), -- -1 = left, 1 = right
    audio_effects JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(project_id, position, type) -- Prevent duplicate positions per type
);

-- Video Studio Clips (Timeline clips)
CREATE TABLE video_studio_clips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES video_studio_projects(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES video_studio_tracks(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES video_studio_assets(id) ON DELETE SET NULL, -- NULL for generated content
    
    -- Timeline positioning (microsecond precision)
    start_time DECIMAL(12,6) NOT NULL, -- Seconds with microsecond precision
    end_time DECIMAL(12,6) NOT NULL,
    layer_index INTEGER DEFAULT 0, -- Z-index for overlapping clips
    
    -- Source trimming
    trim_start DECIMAL(12,6) DEFAULT 0.0,
    trim_end DECIMAL(12,6),
    
    -- Transform properties
    position_x DECIMAL(8,3) DEFAULT 0.0,
    position_y DECIMAL(8,3) DEFAULT 0.0,
    scale_x DECIMAL(5,3) DEFAULT 1.0,
    scale_y DECIMAL(5,3) DEFAULT 1.0,
    rotation DECIMAL(6,2) DEFAULT 0.0, -- Degrees
    anchor_x DECIMAL(3,2) DEFAULT 0.5, -- 0-1 normalized
    anchor_y DECIMAL(3,2) DEFAULT 0.5, -- 0-1 normalized
    
    -- Visual properties
    opacity DECIMAL(3,2) DEFAULT 1.0 CHECK (opacity >= 0 AND opacity <= 1.0),
    blend_mode TEXT DEFAULT 'normal',
    
    -- Audio properties
    volume DECIMAL(3,2) DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 2.0),
    muted BOOLEAN NOT NULL DEFAULT false,
    playback_rate DECIMAL(4,2) DEFAULT 1.0 CHECK (playback_rate > 0 AND playback_rate <= 4.0),
    
    -- Text overlay properties (for text clips)
    text_content JSONB, -- {text, style, animation}
    
    -- Effect chains
    video_effects JSONB DEFAULT '[]'::jsonb,
    audio_effects JSONB DEFAULT '[]'::jsonb,
    
    -- Motion blur and quality
    motion_blur_enabled BOOLEAN DEFAULT false,
    motion_blur_shutter_angle DECIMAL(5,1) DEFAULT 180.0,
    quality_level TEXT DEFAULT 'high' CHECK (quality_level IN ('draft', 'preview', 'high', 'maximum')),
    
    -- Metadata
    name TEXT, -- Custom clip name
    notes TEXT, -- User notes
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CHECK (end_time > start_time),
    CHECK (trim_end IS NULL OR trim_end > trim_start)
);

-- Video Studio Keyframes (Animation data)
CREATE TABLE video_studio_keyframes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clip_id UUID NOT NULL REFERENCES video_studio_clips(id) ON DELETE CASCADE,
    
    -- Keyframe positioning
    time_offset DECIMAL(12,6) NOT NULL, -- Seconds from clip start
    property_path TEXT NOT NULL, -- e.g., 'position.x', 'scale.y', 'volume'
    
    -- Keyframe value (flexible JSON for any property type)
    value JSONB NOT NULL,
    
    -- Interpolation settings
    interpolation_type TEXT DEFAULT 'linear' CHECK (interpolation_type IN (
        'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'bezier', 'step'
    )),
    
    -- Bezier curve control points (for custom curves)
    bezier_control_1 JSONB, -- {x, y} coordinates
    bezier_control_2 JSONB, -- {x, y} coordinates
    
    -- Keyframe metadata
    locked BOOLEAN DEFAULT false,
    selected BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(clip_id, time_offset, property_path),
    CHECK (time_offset >= 0)
);

-- Video Studio Transitions (Between clips)
CREATE TABLE video_studio_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES video_studio_projects(id) ON DELETE CASCADE,
    from_clip_id UUID REFERENCES video_studio_clips(id) ON DELETE CASCADE,
    to_clip_id UUID REFERENCES video_studio_clips(id) ON DELETE CASCADE,
    
    -- Transition properties
    type TEXT NOT NULL CHECK (type IN (
        'cut', 'fade', 'dissolve', 'wipe_left', 'wipe_right', 'wipe_up', 'wipe_down',
        'slide_left', 'slide_right', 'slide_up', 'slide_down',
        'zoom_in', 'zoom_out', 'blur', 'pixelate', 'custom'
    )),
    
    duration DECIMAL(6,3) NOT NULL CHECK (duration > 0),
    
    -- Timing and easing
    ease_in DECIMAL(3,2) DEFAULT 0.0,
    ease_out DECIMAL(3,2) DEFAULT 0.0,
    
    -- Custom parameters for each transition type
    parameters JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Video Studio Effects (Reusable effects library)
CREATE TABLE video_studio_effects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system effects
    
    -- Effect identification
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'color', 'blur', 'distortion', 'stylize', 'noise', 'sharpen',
        'audio_filter', 'audio_eq', 'audio_dynamics', 'transition', 'generator'
    )),
    type TEXT NOT NULL, -- Specific effect type within category
    
    -- Effect definition
    parameters_schema JSONB NOT NULL, -- JSON schema for parameters
    default_parameters JSONB NOT NULL,
    
    -- Metadata
    description TEXT,
    thumbnail_url TEXT,
    is_system_effect BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Video Studio Project History (Undo/Redo and versioning)
CREATE TABLE video_studio_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES video_studio_projects(id) ON DELETE CASCADE,
    
    -- Action details
    action_type TEXT NOT NULL CHECK (action_type IN (
        'clip_add', 'clip_remove', 'clip_move', 'clip_resize', 'clip_split',
        'track_add', 'track_remove', 'track_reorder',
        'effect_add', 'effect_remove', 'effect_modify',
        'keyframe_add', 'keyframe_remove', 'keyframe_modify',
        'transition_add', 'transition_remove', 'transition_modify',
        'project_settings', 'bulk_operation'
    )),
    
    -- Action data for undo/redo
    action_data JSONB NOT NULL,
    reverse_action_data JSONB, -- For efficient undo
    
    -- Context
    affected_objects JSONB, -- IDs of affected clips, tracks, etc.
    user_action BOOLEAN DEFAULT true, -- false for auto-save snapshots
    
    -- Grouping (for compound operations)
    operation_group_id UUID,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Video Studio Collaboration (Real-time editing)
CREATE TABLE video_studio_collaboration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES video_studio_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session info
    session_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Permissions
    role TEXT DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    can_edit BOOLEAN DEFAULT true,
    can_export BOOLEAN DEFAULT false,
    can_share BOOLEAN DEFAULT false,
    
    -- Presence data
    cursor_position JSONB, -- Current timeline position and selected objects
    viewport_state JSONB, -- Zoom, scroll position
    
    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Projects
CREATE INDEX idx_video_projects_user_id ON video_studio_projects(user_id);
CREATE INDEX idx_video_projects_status ON video_studio_projects(status);
CREATE INDEX idx_video_projects_updated_at ON video_studio_projects(updated_at DESC);
CREATE INDEX idx_video_projects_last_opened ON video_studio_projects(last_opened_at DESC);

-- Assets
CREATE INDEX idx_video_assets_user_id ON video_studio_assets(user_id);
CREATE INDEX idx_video_assets_fingerprint ON video_studio_assets(fingerprint);
CREATE INDEX idx_video_assets_content_type ON video_studio_assets(content_type);
CREATE INDEX idx_video_assets_filename ON video_studio_assets USING gin(original_filename gin_trgm_ops);
CREATE INDEX idx_video_assets_usage ON video_studio_assets(usage_count DESC);

-- Tracks
CREATE INDEX idx_video_tracks_project_id ON video_studio_tracks(project_id);
CREATE INDEX idx_video_tracks_position ON video_studio_tracks(project_id, position);

-- Clips (Critical for timeline performance)
CREATE INDEX idx_video_clips_project_id ON video_studio_clips(project_id);
CREATE INDEX idx_video_clips_track_id ON video_studio_clips(track_id);
CREATE INDEX idx_video_clips_timeline ON video_studio_clips(project_id, start_time, end_time);
CREATE INDEX idx_video_clips_asset_id ON video_studio_clips(asset_id);
CREATE INDEX idx_video_clips_layer ON video_studio_clips(track_id, layer_index);

-- Keyframes (Critical for animation performance)
CREATE INDEX idx_video_keyframes_clip_id ON video_studio_keyframes(clip_id);
CREATE INDEX idx_video_keyframes_property ON video_studio_keyframes(clip_id, property_path);
CREATE INDEX idx_video_keyframes_time ON video_studio_keyframes(clip_id, time_offset);

-- Transitions
CREATE INDEX idx_video_transitions_project_id ON video_studio_transitions(project_id);
CREATE INDEX idx_video_transitions_clips ON video_studio_transitions(from_clip_id, to_clip_id);

-- History (for undo/redo performance)
CREATE INDEX idx_video_history_project_id ON video_studio_history(project_id, created_at DESC);
CREATE INDEX idx_video_history_group ON video_studio_history(operation_group_id);

-- Collaboration
CREATE INDEX idx_video_collaboration_project_id ON video_studio_collaboration(project_id);
CREATE INDEX idx_video_collaboration_active ON video_studio_collaboration(project_id, is_active);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATES
-- =====================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_video_projects_updated_at BEFORE UPDATE ON video_studio_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_assets_updated_at BEFORE UPDATE ON video_studio_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_tracks_updated_at BEFORE UPDATE ON video_studio_tracks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_clips_updated_at BEFORE UPDATE ON video_studio_clips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_video_transitions_updated_at BEFORE UPDATE ON video_studio_transitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update project's last_opened_at when accessed
CREATE OR REPLACE FUNCTION update_project_last_opened()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE video_studio_projects 
    SET last_opened_at = NOW() 
    WHERE id = NEW.project_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger when clips are accessed (indicates project is being worked on)
CREATE TRIGGER update_project_access_on_clip_change 
    AFTER INSERT OR UPDATE ON video_studio_clips 
    FOR EACH ROW EXECUTE FUNCTION update_project_last_opened();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE video_studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_keyframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_studio_collaboration ENABLE ROW LEVEL SECURITY;

-- Projects: Users can only access their own projects or shared projects
CREATE POLICY "Users can manage their own projects" ON video_studio_projects
    FOR ALL USING (
        user_id = auth.uid() OR 
        auth.uid()::text = ANY(
            SELECT jsonb_array_elements_text(collaborators)
        )
    );

-- Assets: Users can only access their own assets
CREATE POLICY "Users can manage their own assets" ON video_studio_assets
    FOR ALL USING (user_id = auth.uid());

-- Tracks: Users can access tracks of their projects
CREATE POLICY "Users can access tracks of their projects" ON video_studio_tracks
    FOR ALL USING (
        project_id IN (
            SELECT id FROM video_studio_projects 
            WHERE user_id = auth.uid() OR 
                  auth.uid()::text = ANY(
                      SELECT jsonb_array_elements_text(collaborators)
                  )
        )
    );

-- Clips: Users can access clips of their projects
CREATE POLICY "Users can access clips of their projects" ON video_studio_clips
    FOR ALL USING (
        project_id IN (
            SELECT id FROM video_studio_projects 
            WHERE user_id = auth.uid() OR 
                  auth.uid()::text = ANY(
                      SELECT jsonb_array_elements_text(collaborators)
                  )
        )
    );

-- Keyframes: Users can access keyframes of their clips
CREATE POLICY "Users can access keyframes of their clips" ON video_studio_keyframes
    FOR ALL USING (
        clip_id IN (
            SELECT c.id FROM video_studio_clips c
            JOIN video_studio_projects p ON c.project_id = p.id
            WHERE p.user_id = auth.uid() OR 
                  auth.uid()::text = ANY(
                      SELECT jsonb_array_elements_text(p.collaborators)
                  )
        )
    );

-- Transitions: Users can access transitions of their projects
CREATE POLICY "Users can access transitions of their projects" ON video_studio_transitions
    FOR ALL USING (
        project_id IN (
            SELECT id FROM video_studio_projects 
            WHERE user_id = auth.uid() OR 
                  auth.uid()::text = ANY(
                      SELECT jsonb_array_elements_text(collaborators)
                  )
        )
    );

-- Effects: Users can access their own effects and system effects
CREATE POLICY "Users can access effects" ON video_studio_effects
    FOR ALL USING (
        user_id = auth.uid() OR 
        user_id IS NULL OR 
        is_system_effect = true
    );

-- History: Users can access history of their projects
CREATE POLICY "Users can access history of their projects" ON video_studio_history
    FOR ALL USING (
        project_id IN (
            SELECT id FROM video_studio_projects 
            WHERE user_id = auth.uid() OR 
                  auth.uid()::text = ANY(
                      SELECT jsonb_array_elements_text(collaborators)
                  )
        )
    );

-- Collaboration: Users can access collaboration data of their projects
CREATE POLICY "Users can access collaboration data" ON video_studio_collaboration
    FOR ALL USING (
        user_id = auth.uid() OR
        project_id IN (
            SELECT id FROM video_studio_projects 
            WHERE user_id = auth.uid() OR 
                  auth.uid()::text = ANY(
                      SELECT jsonb_array_elements_text(collaborators)
                  )
        )
    );

-- =====================================================
-- PERFORMANCE VIEWS
-- =====================================================

-- Project overview with stats
CREATE VIEW video_studio_project_overview AS
SELECT 
    p.*,
    COUNT(DISTINCT t.id) as track_count,
    COUNT(DISTINCT c.id) as clip_count,
    COUNT(DISTINCT a.id) as asset_count,
    COALESCE(SUM(a.file_size_bytes), 0) as total_size_bytes,
    MAX(c.end_time) as actual_duration
FROM video_studio_projects p
LEFT JOIN video_studio_tracks t ON p.id = t.project_id
LEFT JOIN video_studio_clips c ON p.id = c.project_id
LEFT JOIN video_studio_assets a ON c.asset_id = a.id
GROUP BY p.id;

-- Timeline data for efficient loading
CREATE VIEW video_studio_timeline_data AS
SELECT 
    c.*,
    t.name as track_name,
    t.type as track_type,
    t.position as track_position,
    a.original_filename,
    a.content_type,
    a.duration_seconds as asset_duration,
    a.width,
    a.height
FROM video_studio_clips c
JOIN video_studio_tracks t ON c.track_id = t.id
LEFT JOIN video_studio_assets a ON c.asset_id = a.id
ORDER BY t.position, c.layer_index, c.start_time;

COMMENT ON TABLE video_studio_projects IS 'Main container for video editing projects with comprehensive metadata and settings';
COMMENT ON TABLE video_studio_assets IS 'Media asset metadata and fingerprints for IndexedDB file linking and auto-recovery';
COMMENT ON TABLE video_studio_tracks IS 'Timeline tracks with visual and audio properties for professional editing';
COMMENT ON TABLE video_studio_clips IS 'Individual clips on timeline with transform, effects, and timing data';
COMMENT ON TABLE video_studio_keyframes IS 'Animation keyframes for professional motion graphics and effects';
COMMENT ON TABLE video_studio_transitions IS 'Transitions between clips with customizable parameters and timing';
COMMENT ON TABLE video_studio_effects IS 'Reusable effects library for video and audio processing';
COMMENT ON TABLE video_studio_history IS 'Complete editing history for unlimited undo/redo functionality';
COMMENT ON TABLE video_studio_collaboration IS 'Real-time collaboration support with user presence and permissions'; 