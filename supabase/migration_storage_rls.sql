-- =============================================================
-- Migration: Tighten storage RLS for cert-images bucket
-- Replace overly-permissive "any authenticated user" policies
-- with scoped policies that verify file ownership via
-- certifications.image_url -> employees.manager_id chain.
--
-- Upload path: certs/<uuid>.<ext>  (stored in certifications.image_url)
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Drop existing permissive policies
DROP POLICY IF EXISTS "cert_images_upload" ON storage.objects;
DROP POLICY IF EXISTS "cert_images_select" ON storage.objects;
DROP POLICY IF EXISTS "cert_images_update" ON storage.objects;
DROP POLICY IF EXISTS "cert_images_delete" ON storage.objects;

-- 2. INSERT: allow authenticated users to upload to cert-images bucket.
--    New uploads don't have a certifications row yet (the cert is created
--    after the upload), so we only restrict to authenticated + correct bucket.
CREATE POLICY "cert_images_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cert-images'
    AND auth.role() = 'authenticated'
  );

-- 3. SELECT: only allow reading files that belong to the user's own employees.
--    Matches storage.objects.name against certifications.image_url for
--    employees owned by the current user.
CREATE POLICY "cert_images_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cert-images'
    AND auth.role() = 'authenticated'
    AND name IN (
      SELECT c.image_url FROM certifications c
      INNER JOIN employees e ON e.id = c.employee_id
      WHERE e.manager_id = auth.uid()
        AND c.image_url IS NOT NULL
    )
  );

-- 4. UPDATE: only allow updating files owned by the user's employees.
CREATE POLICY "cert_images_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cert-images'
    AND auth.role() = 'authenticated'
    AND name IN (
      SELECT c.image_url FROM certifications c
      INNER JOIN employees e ON e.id = c.employee_id
      WHERE e.manager_id = auth.uid()
        AND c.image_url IS NOT NULL
    )
  );

-- 5. DELETE: only allow deleting files owned by the user's employees.
CREATE POLICY "cert_images_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cert-images'
    AND auth.role() = 'authenticated'
    AND name IN (
      SELECT c.image_url FROM certifications c
      INNER JOIN employees e ON e.id = c.employee_id
      WHERE e.manager_id = auth.uid()
        AND c.image_url IS NOT NULL
    )
  );
