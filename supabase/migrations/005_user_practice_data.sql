-- User practice data table for cross-device sync of plans, logs, and segment completions
CREATE TABLE IF NOT EXISTS user_practice_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  logs_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completions_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_practice_data ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated user access
CREATE POLICY "Users can view own practice data"
  ON user_practice_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice data"
  ON user_practice_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice data"
  ON user_practice_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice data"
  ON user_practice_data FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_practice_data_user_id ON user_practice_data(user_id);
