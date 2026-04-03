"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createCertType(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const name = formData.get("name") as string;
  const default_validity_months = parseInt(
    formData.get("default_validity_months") as string,
    10
  );
  const description = formData.get("description") as string | null;

  const { error } = await supabase.from("cert_types").insert({
    manager_id: user.id,
    name,
    default_validity_months,
    description: description || null,
  });

  if (error) {
    throw new Error(`Failed to create cert type: ${error.message}`);
  }

  revalidatePath("/dashboard/cert-types");
}

export async function updateCertType(id: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const default_validity_months = parseInt(
    formData.get("default_validity_months") as string,
    10
  );
  const description = formData.get("description") as string | null;

  const { error } = await supabase
    .from("cert_types")
    .update({
      name,
      default_validity_months,
      description: description || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update cert type: ${error.message}`);
  }

  revalidatePath("/dashboard/cert-types");
}

export async function deleteCertType(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("cert_types").delete().eq("id", id);

  if (error) {
    if (error.message.includes("violates foreign key constraint")) {
      throw new Error(
        "לא ניתן למחוק סוג הסמכה שמשויך להסמכות קיימות"
      );
    }
    throw new Error(`Failed to delete cert type: ${error.message}`);
  }

  revalidatePath("/dashboard/cert-types");
}
