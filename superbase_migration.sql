-- ============================================================
-- ViziQ - Supabase Database Setup
-- Run this in your Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- Main table to store all processed video results
CREATE TABLE IF NOT EXISTS video_results (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_identifier  TEXT NOT NULL UNIQUE,  -- YouTube video ID or file MD5 hash
  video_type        TEXT NOT NULL CHECK (video_type IN ('youtube', 'upload')),
  title             TEXT,
  transcript        TEXT,
  summary           TEXT,
  key_points        JSONB,     -- array of { title, detail, emoji }
  infographic_html  TEXT,      -- complete standalone HTML infographic
  ocr_text          TEXT,      -- raw OCR from video frames (uploads only)
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by identifier (cache key)
CREATE INDEX IF NOT EXISTS idx_video_identifier 
  ON video_results (video_identifier);

-- Index for listing recent results
CREATE INDEX IF NOT EXISTS idx_created_at 
  ON video_results (created_at DESC);

-- Enable Row Level Security (good practice)
ALTER TABLE video_results ENABLE ROW LEVEL SECURITY;

-- Policy: allow server-side (service key) full access
-- The service key bypasses RLS automatically, so this policy
-- is just for anon/authenticated reads if you want to expose them.
CREATE POLICY "Allow public read v2"
  ON public.video_results
  FOR SELECT
  TO PUBLIC
  USING (true);

-- ============================================================
-- Verify it worked:
-- ============================================================
-- SELECT * FROM video_results LIMIT 5;