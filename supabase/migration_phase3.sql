-- =============================================================
-- Phase 3 Migration: Add employee status + nullable cert dates
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Add status field to employees (default: פעיל = active)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'פעיל';

-- 2. Make certification dates nullable (for bulk imports without dates)
ALTER TABLE certifications ALTER COLUMN issue_date DROP NOT NULL;
ALTER TABLE certifications ALTER COLUMN expiry_date DROP NOT NULL;

-- 3. Unique constraint for employee dedup per manager
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_manager_number
  ON employees(manager_id, employee_number);

-- 4. Unique constraint for cert type dedup per manager
CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_types_manager_name
  ON cert_types(manager_id, name);
