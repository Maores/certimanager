-- Agent harness seed fixture.
-- Resets staging to a known baseline. Runs under service_role (RLS bypassed).
-- Idempotent: safe to re-run between journeys.
--
-- Executed via the public.exec_sql RPC (PL/pgSQL EXECUTE). Transaction control
-- commands (BEGIN/COMMIT/ROLLBACK) are NOT allowed inside EXECUTE — the RPC
-- already runs within an implicit transaction.
--
-- Structure of this file:
--   1. DDL self-heal (mirrors migration_phase3.sql + migration_cert_types_v2.sql)
--   2. TRUNCATE dependent tables
--   3. Seed rows

-- =============================================================
-- 1. Self-heal schema drift — re-assert upsert-critical structures.
-- Staging was provisioned from schema.sql only; these DDL blocks
-- mirror the later migrations so the harness can run regardless of
-- which migrations have/haven't been applied to a given Supabase project.
-- All statements are IF NOT EXISTS / idempotent.
-- =============================================================

-- From migration_phase3.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_manager_number
  ON employees(manager_id, employee_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_types_manager_name
  ON cert_types(manager_id, name);

-- From migration_cert_types_v2.sql — the course_candidates table + its
-- promotion-dedup unique index on certifications.
CREATE TABLE IF NOT EXISTS course_candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id    uuid NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  id_number     text NOT NULL,
  phone         text,
  city          text,
  cert_type_id  uuid NOT NULL REFERENCES cert_types(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'ממתין',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(manager_id, id_number, cert_type_id)
);
CREATE INDEX IF NOT EXISTS idx_candidates_manager ON course_candidates(manager_id);
CREATE INDEX IF NOT EXISTS idx_candidates_manager_status ON course_candidates(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_id_number ON course_candidates(id_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_employee_cert_type
  ON certifications(employee_id, cert_type_id);

-- From migration_feedback.sql
CREATE TABLE IF NOT EXISTS feedback (
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
  ON feedback (manager_id, created_at DESC);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feedback_select_own ON feedback;
CREATE POLICY feedback_select_own ON feedback FOR SELECT USING (manager_id = auth.uid());
DROP POLICY IF EXISTS feedback_insert_own ON feedback;
CREATE POLICY feedback_insert_own ON feedback FOR INSERT WITH CHECK (manager_id = auth.uid());
DROP POLICY IF EXISTS feedback_update_own ON feedback;
CREATE POLICY feedback_update_own ON feedback FOR UPDATE USING (manager_id = auth.uid());

-- =============================================================
-- 2. Clear dependent tables (order matters for FK cascades).
-- =============================================================
TRUNCATE TABLE feedback RESTART IDENTITY CASCADE;
TRUNCATE TABLE certifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE course_candidates RESTART IDENTITY CASCADE;
TRUNCATE TABLE employees RESTART IDENTITY CASCADE;
TRUNCATE TABLE cert_types RESTART IDENTITY CASCADE;

-- =============================================================
-- 3. Seed rows.
-- =============================================================

-- Ensure the admin manager row exists and is keyed to the auth user.
-- on_auth_user_created trigger is dropped on staging, so we do this manually.
-- ON CONFLICT keeps re-runs idempotent.
INSERT INTO managers (id, email, full_name)
VALUES (
  'd4a5b88a-496f-4d18-95a8-b39e6a8f51db',
  'admin@test.local',
  'Test Admin'
)
ON CONFLICT (id) DO NOTHING;

-- 4 cert types owned by the admin manager.
INSERT INTO cert_types (id, manager_id, name, default_validity_months) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'נת״ע',        24),
  ('aaaa2222-2222-2222-2222-222222222222', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'כביש 6',      36),
  ('aaaa3333-3333-3333-3333-333333333333', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'חוצה ישראל',  36),
  ('aaaa4444-4444-4444-4444-444444444444', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'נתיבי ישראל', 12);

-- 5 employees across two departments.
INSERT INTO employees (id, manager_id, first_name, last_name, employee_number, department) VALUES
  ('bbbb1111-1111-1111-1111-111111111111', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'יוסי',    'כהן',      '123456789', 'תפעול'),
  ('bbbb2222-2222-2222-2222-222222222222', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'דנה',     'לוי',      '234567890', 'תפעול'),
  ('bbbb3333-3333-3333-3333-333333333333', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'משה',     'פרץ',      '345678901', 'ניהול'),
  ('bbbb4444-4444-4444-4444-444444444444', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'רונית',   'אברהם',    '456789012', 'ניהול'),
  ('bbbb5555-5555-5555-5555-555555555555', 'd4a5b88a-496f-4d18-95a8-b39e6a8f51db', 'אחמד',    'עומר',     '567890123', 'תפעול');

-- 3 certifications exercising the 3 date regimes the UI must render:
--   1) refresh-only (regime_1_partial) → status derives from next_refresh_date
--   2) issue + expiry, no refresh        → status derives from expiry_date
--   3) no dates at all                    → status 'לא ידוע'
INSERT INTO certifications (id, employee_id, cert_type_id, issue_date, expiry_date, next_refresh_date) VALUES
  ('cccc1111-1111-1111-1111-111111111111', 'bbbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', '2025-03-15', NULL,         '2027-03-15'),
  ('cccc2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'aaaa2222-2222-2222-2222-222222222222', '2024-07-01', '2027-07-01', NULL),
  ('cccc3333-3333-3333-3333-333333333333', 'bbbb3333-3333-3333-3333-333333333333', 'aaaa3333-3333-3333-3333-333333333333', NULL,         NULL,         NULL);
