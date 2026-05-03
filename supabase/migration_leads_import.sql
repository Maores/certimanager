-- Migration: Daily leads import — schema changes
-- Run against Supabase SQL Editor.

-- ============================================
-- PART A: police_clearance_status enum
-- ============================================
DO $$ BEGIN
  CREATE TYPE police_clearance_status AS ENUM (
    'לא נשלח',
    'נשלח',
    'אושר',
    'נדחה'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PART B: course_candidates extensions
-- ============================================
-- The existing `notes` column on course_candidates is reused for lead notes;
-- no new notes column needed.

ALTER TABLE course_candidates ALTER COLUMN cert_type_id DROP NOT NULL;

ALTER TABLE course_candidates
  ADD COLUMN IF NOT EXISTS police_clearance_status police_clearance_status NOT NULL DEFAULT 'לא נשלח';

ALTER TABLE course_candidates
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Partial index for unread filter
CREATE INDEX IF NOT EXISTS idx_course_candidates_unread
  ON course_candidates (created_at DESC)
  WHERE read_at IS NULL;

-- ============================================
-- PART C: seed קורס משולב cert type per manager
-- ============================================
INSERT INTO cert_types (manager_id, name, default_validity_months)
SELECT m.id, 'קורס משולב', 12 FROM managers m
WHERE NOT EXISTS (
  SELECT 1 FROM cert_types ct
  WHERE ct.manager_id = m.id AND ct.name = 'קורס משולב'
);

-- ============================================
-- PART D: drop the single fake test candidate (one-shot, idempotent)
-- ============================================
-- On a virgin DB the table holds a single fake row left over from manual testing.
-- Drop it. On any DB that already has real data (count > 1), skip silently — this
-- block must never delete real data on re-run.
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM course_candidates;
  IF cnt = 1 THEN
    DELETE FROM course_candidates;
    RAISE NOTICE 'Deleted 1 fake test candidate.';
  ELSIF cnt > 1 THEN
    RAISE NOTICE 'course_candidates already populated (% rows). Skipping cleanup.', cnt;
  END IF;
END $$;
