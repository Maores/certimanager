-- Add original-filename column to certifications.
-- Captures the user's original filename at upload time so the list UI
-- can show something readable instead of a generic "מצורף" badge.
-- Nullable: existing rows have no captured filename and fall back to
-- a generic "קובץ" label in the UI.

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS image_filename TEXT;
