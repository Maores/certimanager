-- supabase/migration_feedback_delete.sql
-- Adds DELETE permission to public.feedback, scoped to row owner.
-- Supersedes the v1 "No DELETE policy: audit trail" decision.
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS feedback_delete_own ON public.feedback;
CREATE POLICY feedback_delete_own ON public.feedback
  FOR DELETE USING (manager_id = auth.uid());
