"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCertification(formData: FormData) {
  const supabase = await createClient();

  const employee_id = formData.get("employee_id") as string;
  const cert_type_id = formData.get("cert_type_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const expiry_date = formData.get("expiry_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const notes = formData.get("notes") as string | null;

  const { error } = await supabase.from("certifications").insert({
    employee_id,
    cert_type_id,
    issue_date: issue_date || null,
    expiry_date: expiry_date || null,
    image_url: image_url || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(`Failed to create certification: ${error.message}`);
  }

  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}

export async function updateCertification(id: string, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cert } = await supabase
    .from("certifications")
    .select("employee_id, employees!inner(manager_id)")
    .eq("id", id)
    .single();

  if (!cert || (cert.employees as any).manager_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const employee_id = formData.get("employee_id") as string;
  const cert_type_id = formData.get("cert_type_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const expiry_date = formData.get("expiry_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const notes = formData.get("notes") as string | null;

  const { error } = await supabase
    .from("certifications")
    .update({
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      image_url: image_url || null,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update certification: ${error.message}`);
  }

  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}

export async function deleteCertification(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cert } = await supabase
    .from("certifications")
    .select("employee_id, employees!inner(manager_id)")
    .eq("id", id)
    .single();

  if (!cert || (cert.employees as any).manager_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("certifications")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete certification: ${error.message}`);
  }

  revalidatePath("/dashboard/certifications");
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadCertImage(formData: FormData) {
  const supabase = await createClient();

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("הקובץ גדול מדי. הגודל המקסימלי הוא 5MB");
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("סוג קובץ לא נתמך. יש להעלות JPG, PNG, WebP או PDF");
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `certs/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("cert-images")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`שגיאה בהעלאת הקובץ: ${uploadError.message}`);
  }

  // Return the storage path (not a public URL — bucket is private)
  return filePath;
}

export async function getSignedUrl(filePath: string) {
  if (!filePath) return null;

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("cert-images")
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (error) return null;
  return data.signedUrl;
}

export async function deleteCertImage(filePath: string) {
  if (!filePath) return;

  const supabase = await createClient();

  await supabase.storage.from("cert-images").remove([filePath]);
}
