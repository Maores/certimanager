-- Add next_refresh_date column to certifications table.
-- Captures "מועד רענון הבא" from the נת״ע xlsx export (regime 1 rows).
-- Nullable because most historical certs and regime-2 rows will not have it.

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS next_refresh_date DATE;
