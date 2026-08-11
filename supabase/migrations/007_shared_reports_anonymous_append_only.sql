-- Tighten RLS on shared_reports so anonymous rows are append-only.
--
-- Migration 004 relaxed UPDATE to allow either the row's owner *or* any caller
-- when user_id IS NULL. The intent was to let a signed-in user "claim" a report
-- they had created anonymously by setting user_id on the row. In practice it
-- means any unauthenticated visitor can rewrite the JSON payload of any
-- anonymously-shared report if they can guess/enumerate its 10-char slug.
-- Combined with the fact that the payload is rendered in other people's
-- browsers, this is a stored-XSS / tampering vector.
--
-- This migration replaces the update policy with two narrower ones:
--   * Authenticated users can update their own rows (auth.uid() = user_id) —
--     unchanged from the pre-004 behaviour.
--   * Authenticated users can *claim* an anonymous row (transition user_id
--     from NULL to their own auth.uid()). The USING clause still permits the
--     row selection while user_id IS NULL, but the WITH CHECK requires the
--     new user_id to equal auth.uid(), so an authenticated user cannot rewrite
--     the report's data without also owning it, and cannot re-anonymise a row.
--   * There is NO policy that permits an anonymous request (auth.uid() IS
--     NULL) to update anything, so anonymous rows are effectively append-only.

DROP POLICY IF EXISTS "Allow users to update own reports" ON shared_reports;

CREATE POLICY "Allow users to update own reports"
  ON shared_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to claim anonymous reports"
  ON shared_reports FOR UPDATE
  TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);
