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
    issue_date,
    expiry_date,
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
      issue_date,
      expiry_date,
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

  const { error } = await supabase
    .from("certifications")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete certification: ${error.message}`);
  }

  revalidatePath("/dashboard/certifications");
}

export async function uploadCertImage(formData: FormData) {
  const supabase = await createClient();

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `certs/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("cert-images")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("cert-images").getPublicUrl(filePath);

  return publicUrl;
}
