-- One-off data migration: correct נת״ע certs where a prior import tool
-- mis-stored the "מועד רענון הבא" value in the expiry_date column.
--
-- Context: Before the "capture dates on import" feature existed, an earlier
-- import tool interpreted 'תוקף תעודה' → issue_date but then placed
-- 'מועד רענון הבא' into expiry_date. Under the new two-regime model, when
-- 'מועד רענון הבא' is present it should land in next_refresh_date and the
-- expiry_date should be null.
--
-- This migration affects ONLY certs tied to the cert_type named 'נת״ע' where
-- expiry_date is populated and next_refresh_date is null.
-- It is IDEMPOTENT: re-running has no effect once applied.
--
-- Run in Supabase SQL editor. Steps:
--   (1) Run the SELECT preview first; verify the row count and a few samples.
--   (2) If the preview looks right, run the UPDATE.
--   (3) Optional: run the post-check to confirm expected end state.

-- ============================================================================
-- (1) PREVIEW — shows what will change. Run this alone first.
-- ============================================================================
SELECT
  c.id,
  e.first_name,
  e.last_name,
  e.employee_number,
  ct.name        AS cert_type,
  c.issue_date   AS before_issue,
  c.expiry_date  AS before_expiry,
  c.next_refresh_date AS before_refresh,
  -- After migration (what the UPDATE would produce)
  c.issue_date   AS after_issue,
  NULL           AS after_expiry,
  c.expiry_date  AS after_refresh
FROM certifications c
JOIN cert_types ct ON ct.id = c.cert_type_id
JOIN employees  e  ON e.id  = c.employee_id
WHERE ct.name = 'נת״ע'
  AND c.expiry_date      IS NOT NULL
  AND c.next_refresh_date IS NULL
ORDER BY e.last_name, e.first_name;

-- ============================================================================
-- (2) APPLY — run after verifying the preview above.
-- ============================================================================
-- BEGIN;  -- uncomment to wrap in a transaction if your SQL editor supports it
UPDATE certifications
SET next_refresh_date = expiry_date,
    expiry_date       = NULL
WHERE cert_type_id IN (
    SELECT id FROM cert_types WHERE name = 'נת״ע'
  )
  AND expiry_date      IS NOT NULL
  AND next_refresh_date IS NULL;
-- COMMIT;

-- ============================================================================
-- (3) POST-CHECK — confirm expected end state. Rows should be zero.
-- ============================================================================
SELECT COUNT(*) AS should_be_zero
FROM certifications c
JOIN cert_types ct ON ct.id = c.cert_type_id
WHERE ct.name = 'נת״ע'
  AND c.expiry_date      IS NOT NULL
  AND c.next_refresh_date IS NULL;

-- Regime distribution after migration:
SELECT
  CASE
    WHEN issue_date IS NOT NULL AND next_refresh_date IS NOT NULL AND expiry_date IS NULL THEN 'regime_1 (issue+refresh)'
    WHEN issue_date IS NULL     AND next_refresh_date IS NOT NULL AND expiry_date IS NULL THEN 'regime_1_partial (refresh only)'
    WHEN expiry_date IS NOT NULL AND issue_date IS NULL AND next_refresh_date IS NULL     THEN 'regime_2 (expiry only)'
    WHEN issue_date IS NULL AND expiry_date IS NULL AND next_refresh_date IS NULL         THEN 'empty'
    ELSE 'other/partial'
  END                                  AS shape,
  COUNT(*)                             AS count
FROM certifications c
JOIN cert_types ct ON ct.id = c.cert_type_id
WHERE ct.name = 'נת״ע'
GROUP BY 1
ORDER BY count DESC;
