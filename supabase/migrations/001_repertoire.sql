-- Repertoire Manager Schema
-- Run this in your Supabase SQL Editor

-- Repertoire pieces table
CREATE TABLE IF NOT EXISTS repertoire (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Piece',
  composer TEXT DEFAULT '',
  level TEXT DEFAULT '',
  type TEXT DEFAULT 'repertoire' CHECK (type IN ('repertoire', 'etude', 'scale', 'sight-reading', 'other')),
  status TEXT DEFAULT 'learning' CHECK (status IN ('learning', 'maintaining', 'performance-ready', 'archived')),
  start_date DATE,
  target_date DATE,
  video_url TEXT,
  notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE repertoire ENABLE ROW LEVEL SECURITY;

-- Users can only access their own repertoire
CREATE POLICY "Users can view own repertoire"
  ON repertoire FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own repertoire"
  ON repertoire FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own repertoire"
  ON repertoire FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own repertoire"
  ON repertoire FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-set user_id on insert
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_repertoire_user_id
  BEFORE INSERT ON repertoire
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id();

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_repertoire_user_id ON repertoire(user_id);
CREATE INDEX IF NOT EXISTS idx_repertoire_status ON repertoire(user_id, status);
