-- Agent harness seed fixture.
-- Resets staging to a known baseline. Runs under service_role (RLS bypassed).
-- Idempotent: safe to re-run between journeys.
--
-- Executed via the public.exec_sql RPC (PL/pgSQL EXECUTE). Transaction control
-- commands (BEGIN/COMMIT/ROLLBACK) are NOT allowed inside EXECUTE — the RPC
-- already runs within an implicit transaction.

-- Clear dependent tables first.
TRUNCATE TABLE certifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE employees RESTART IDENTITY CASCADE;
TRUNCATE TABLE cert_types RESTART IDENTITY CASCADE;

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
