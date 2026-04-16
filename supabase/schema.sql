-- =============================================================
-- CertiManager - Complete Database Schema for Supabase
-- =============================================================

-- Managers profile (linked to auth.users)
CREATE TABLE managers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certification types
CREATE TABLE cert_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_validity_months INTEGER NOT NULL DEFAULT 12,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  employee_number TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'פעיל',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certifications
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_type_id UUID NOT NULL REFERENCES cert_types(id) ON DELETE RESTRICT,
  issue_date DATE,
  expiry_date DATE,
  next_refresh_date DATE,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- Indexes
-- =============================================================
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_certifications_employee ON certifications(employee_id);
CREATE INDEX idx_certifications_expiry ON certifications(expiry_date);
CREATE INDEX idx_cert_types_manager ON cert_types(manager_id);

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cert_types ENABLE ROW LEVEL SECURITY;

-- Managers can only see their own profile
CREATE POLICY "managers_own" ON managers FOR ALL USING (id = auth.uid());

-- Employees: managers see only their own
CREATE POLICY "employees_own" ON employees FOR ALL USING (manager_id = auth.uid());

-- Cert types: managers see only their own
CREATE POLICY "cert_types_own" ON cert_types FOR ALL USING (manager_id = auth.uid());

-- Certifications: managers see only their employees' certs
CREATE POLICY "certs_own" ON certifications FOR ALL USING (
  employee_id IN (SELECT id FROM employees WHERE manager_id = auth.uid())
);

-- =============================================================
-- Updated_at trigger
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_certifications_updated_at
  BEFORE UPDATE ON certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Auto-create manager profile on signup
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO managers (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- Storage bucket for cert images
-- =============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('cert-images', 'cert-images', false);

-- Storage policy: authenticated users can upload
CREATE POLICY "cert_images_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cert-images' AND auth.role() = 'authenticated');

-- Storage policy: authenticated users can view their uploads
CREATE POLICY "cert_images_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'cert-images' AND auth.role() = 'authenticated');

-- Storage policy: authenticated users can update their uploads
CREATE POLICY "cert_images_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'cert-images' AND auth.role() = 'authenticated');

-- Storage policy: authenticated users can delete their uploads
CREATE POLICY "cert_images_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'cert-images' AND auth.role() = 'authenticated');
