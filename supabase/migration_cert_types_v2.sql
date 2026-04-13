-- Migration: Update cert types + create course_candidates table
-- Run against Supabase SQL Editor

-- ============================================
-- PART A: Update certification types (all managers)
-- ============================================

-- Add "חוצה ישראל" for all managers
INSERT INTO cert_types (manager_id, name, default_validity_months)
SELECT m.id, 'חוצה ישראל', 12 FROM managers m
WHERE NOT EXISTS (
  SELECT 1 FROM cert_types ct WHERE ct.manager_id = m.id AND ct.name = 'חוצה ישראל'
);

-- Add "נתיבי ישראל" for all managers
INSERT INTO cert_types (manager_id, name, default_validity_months)
SELECT m.id, 'נתיבי ישראל', 12 FROM managers m
WHERE NOT EXISTS (
  SELECT 1 FROM cert_types ct WHERE ct.manager_id = m.id AND ct.name = 'נתיבי ישראל'
);

-- Rename "PFI" → "חוצה צפון (PFI)" for all managers
UPDATE cert_types SET name = 'חוצה צפון (PFI)' WHERE name = 'PFI';

-- ============================================
-- PART B: Create course_candidates table
-- ============================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidates_manager ON course_candidates(manager_id);
CREATE INDEX IF NOT EXISTS idx_candidates_manager_status ON course_candidates(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_id_number ON course_candidates(id_number);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON course_candidates
FOR EACH ROW EXECUTE FUNCTION update_candidates_updated_at();

-- RLS
ALTER TABLE course_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_own" ON course_candidates FOR ALL
  USING (manager_id = auth.uid());

-- Unique index on certifications for promotion dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_employee_cert_type
  ON certifications(employee_id, cert_type_id);
