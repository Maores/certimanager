-- =============================================================
-- Migration: Add employee task tracking
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Create tasks table
CREATE TABLE employee_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  responsible TEXT,
  status TEXT NOT NULL DEFAULT 'פתוח' CHECK (status IN ('פתוח', 'בטיפול', 'הושלם')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX idx_employee_tasks_employee ON employee_tasks(employee_id);
CREATE INDEX idx_employee_tasks_status ON employee_tasks(status);

-- 3. RLS (same pattern as certifications table)
ALTER TABLE employee_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_own" ON employee_tasks FOR ALL
  USING (employee_id IN (SELECT id FROM employees WHERE manager_id = auth.uid()))
  WITH CHECK (employee_id IN (SELECT id FROM employees WHERE manager_id = auth.uid()));

-- 4. Updated_at trigger (reuses existing function)
CREATE TRIGGER set_employee_tasks_updated_at
  BEFORE UPDATE ON employee_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
