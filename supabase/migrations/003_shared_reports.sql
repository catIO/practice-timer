-- Create shared_reports table
CREATE TABLE IF NOT EXISTS shared_reports (
  id TEXT PRIMARY KEY, -- 10-character random slug (nanoid)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable user reference
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for viewing shared reports)
CREATE POLICY "Allow public read access"
  ON shared_reports FOR SELECT
  USING (true);

-- Allow public insert access (for creating new shared reports)
CREATE POLICY "Allow public insert access"
  ON shared_reports FOR INSERT
  WITH CHECK (true);

-- Allow users to update reports to associate with their account
CREATE POLICY "Allow users to update own reports"
  ON shared_reports FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);
