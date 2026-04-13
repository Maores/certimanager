"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getGuestSessionId } from "@/lib/guest-session";
import {
  guestCreateCertType,
  guestUpdateCertType,
  guestDeleteCertType,
} from "@/lib/guest-store";

export async function createCertType(formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const name = (formData.get("name") as string || "").trim();
    const default_validity_months = parseInt(
      formData.get("default_validity_months") as string,
      10
    );
    const description = formData.get("description") as string | null;

    if (!name) {
      throw new Error("שם סוג ההסמכה הוא שדה חובה");
    }
    if (isNaN(default_validity_months) || default_validity_months < 1) {
      throw new Error("תוקף ברירת מחדל חייב להיות מספר חיובי");
    }

    guestCreateCertType(guestSid, {
      name,
      default_validity_months,
      description: description?.trim() || null,
    });
    revalidatePath("/dashboard/cert-types");
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const name = (formData.get("name") as string || "").trim();
  const default_validity_months = parseInt(
    formData.get("default_validity_months") as string,
    10
  );
  const description = formData.get("description") as string | null;

  if (!name) {
    throw new Error("שם סוג ההסמכה הוא שדה חובה");
  }
  if (isNaN(default_validity_months) || default_validity_months < 1) {
    throw new Error("תוקף ברירת מחדל חייב להיות מספר חיובי");
  }

  const { error } = await supabase.from("cert_types").insert({
    manager_id: user.id,
    name,
    default_validity_months,
    description: description || null,
  });

  if (error) {
    throw new Error(
      error.message.includes("unique constraint")
        ? "סוג הסמכה בשם זה כבר קיים"
        : "שגיאה ביצירת סוג הסמכה. נסה שוב"
    );
  }

  revalidatePath("/dashboard/cert-types");
}

export async function updateCertType(id: string, formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const name = formData.get("name") as string;
    const default_validity_months = parseInt(
      formData.get("default_validity_months") as string,
      10
    );
    const description = formData.get("description") as string | null;

    const success = guestUpdateCertType(guestSid, id, {
      name,
      default_validity_months,
      description: description || null,
    });
    if (!success) throw new Error("Failed to update cert type in guest store");
    revalidatePath("/dashboard/cert-types");
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const name = (formData.get("name") as string || "").trim();
  const default_validity_months = parseInt(
    formData.get("default_validity_months") as string,
    10
  );
  const description = formData.get("description") as string | null;

  if (!name) {
    throw new Error("שם סוג ההסמכה הוא שדה חובה");
  }
  if (isNaN(default_validity_months) || default_validity_months < 1) {
    throw new Error("תוקף ברירת מחדל חייב להיות מספר חיובי");
  }

  const { error } = await supabase
    .from("cert_types")
    .update({
      name,
      default_validity_months,
      description: description || null,
    })
    .eq("id", id)
    .eq("manager_id", user.id);

  if (error) {
    throw new Error(
      error.message.includes("unique constraint")
        ? "סוג הסמכה בשם זה כבר קיים"
        : "שגיאה בעדכון סוג ההסמכה. נסה שוב"
    );
  }

  revalidatePath("/dashboard/cert-types");
}

export async function deleteCertType(id: string) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const success = guestDeleteCertType(guestSid, id);
    if (!success) throw new Error("Failed to delete cert type in guest store");
    revalidatePath("/dashboard/cert-types");
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("cert_types").delete().eq("id", id).eq("manager_id", user.id);

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
