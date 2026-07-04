-- Fix RLS policy to allow anonymous users to upsert/update anonymous reports
DROP POLICY IF EXISTS "Allow users to update own reports" ON shared_reports;

CREATE POLICY "Allow users to update own reports"
  ON shared_reports FOR UPDATE
  USING (
    (auth.uid() = user_id) OR
    (user_id IS NULL)
  )
  WITH CHECK (
    (auth.uid() = user_id) OR
    (user_id IS NULL AND auth.uid() IS NULL)
  );
