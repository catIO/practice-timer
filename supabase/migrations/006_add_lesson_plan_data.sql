-- Add lesson_plan_data to user_practice_data table for cross-device sync of lesson plans
ALTER TABLE user_practice_data
ADD COLUMN IF NOT EXISTS lesson_plan_data JSONB NOT NULL DEFAULT '[]'::jsonb;
