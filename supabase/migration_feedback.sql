-- supabase/migration_feedback.sql
-- Adds the public.feedback table for in-app bug/suggestion reports.
-- Idempotent: safe to re-run against projects that already have it.

CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('bug','suggestion','question','other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  route       text NOT NULL,
  viewport    text,
  user_agent  text,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_manager_created
  ON public.feedback (manager_id, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_select_own ON public.feedback;
CREATE POLICY feedback_select_own ON public.feedback
  FOR SELECT USING (manager_id = auth.uid());

DROP POLICY IF EXISTS feedback_insert_own ON public.feedback;
CREATE POLICY feedback_insert_own ON public.feedback
  FOR INSERT WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS feedback_update_own ON public.feedback;
CREATE POLICY feedback_update_own ON public.feedback
  FOR UPDATE USING (manager_id = auth.uid());
-- No DELETE policy: audit trail.
