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
-- PART D: drop the single fake test candidate
-- ============================================
-- Verify count = 1 before running this block. If more than one row exists, STOP.
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM course_candidates;
  IF cnt > 1 THEN
    RAISE EXCEPTION 'course_candidates row count is %, expected 1. Aborting cleanup.', cnt;
  END IF;
END $$;
DELETE FROM course_candidates;
