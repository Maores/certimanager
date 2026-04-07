"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getGuestSessionId } from "@/lib/guest-session";
import {
  guestCreateCertification,
  guestUpdateCertification,
  guestDeleteCertification,
  getGuestData,
} from "@/lib/guest-store";

function mapSupabaseError(msg: string): string {
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    if (msg.includes("employee_number")) return "מספר עובד כבר קיים במערכת";
    if (msg.includes("email")) return "כתובת אימייל כבר קיימת במערכת";
    return "רשומה כפולה - הנתון כבר קיים במערכת";
  }
  if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
    return "לא ניתן לבצע את הפעולה - קיימים נתונים תלויים";
  }
  if (msg.includes("not found") || msg.includes("no rows")) {
    return "הרשומה לא נמצאה";
  }
  return "שגיאה בשמירת הנתונים. נסה שוב";
}

export async function createCertification(formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const employee_id = formData.get("employee_id") as string;
    const cert_type_id = formData.get("cert_type_id") as string;
    const issue_date = formData.get("issue_date") as string;
    const expiry_date = formData.get("expiry_date") as string;
    const image_url = formData.get("image_url") as string | null;
    const notes = formData.get("notes") as string | null;

    // Check for existing valid certification with same employee_id + cert_type_id
    const guestData = getGuestData(guestSid);
    const today = new Date().toISOString().split("T")[0];
    const existingCert = guestData.certifications.find(
      (c) =>
        c.employee_id === employee_id &&
        c.cert_type_id === cert_type_id &&
        c.expiry_date &&
        c.expiry_date > today
    );
    if (existingCert) {
      throw new Error("לעובד זה כבר יש הסמכה בתוקף מסוג זה");
    }

    await guestCreateCertification(guestSid, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      image_url: image_url || null,
      notes: notes || null,
    });

    revalidatePath("/dashboard/certifications");
    redirect("/dashboard/certifications");
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const employee_id = formData.get("employee_id") as string;
  const cert_type_id = formData.get("cert_type_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const expiry_date = formData.get("expiry_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const notes = formData.get("notes") as string | null;

  // Verify employee belongs to the current manager before doing anything else
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employee_id)
    .eq("manager_id", user.id)
    .single();
  if (!emp) throw new Error("Unauthorized");

  // Verify cert type belongs to the current manager
  const { data: ct } = await supabase
    .from("cert_types")
    .select("id")
    .eq("id", cert_type_id)
    .eq("manager_id", user.id)
    .single();
  if (!ct) throw new Error("Unauthorized");

  // Check for existing valid certification with same employee_id + cert_type_id
  // (ownership already verified above so no need to re-scope)
  const today = new Date().toISOString().split("T")[0];
  const { data: existingCerts } = await supabase
    .from("certifications")
    .select("id")
    .eq("employee_id", employee_id)
    .eq("cert_type_id", cert_type_id)
    .gt("expiry_date", today)
    .limit(1);

  if (existingCerts && existingCerts.length > 0) {
    throw new Error("לעובד זה כבר יש הסמכה בתוקף מסוג זה");
  }

  const { error } = await supabase.from("certifications").insert({
    employee_id,
    cert_type_id,
    issue_date: issue_date || null,
    expiry_date: expiry_date || null,
    image_url: image_url || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}

export async function updateCertification(id: string, formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const employee_id = formData.get("employee_id") as string;
    const cert_type_id = formData.get("cert_type_id") as string;
    const issue_date = formData.get("issue_date") as string;
    const expiry_date = formData.get("expiry_date") as string;
    const image_url = formData.get("image_url") as string | null;
    const notes = formData.get("notes") as string | null;

    const success = await guestUpdateCertification(guestSid, id, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      image_url: image_url || null,
      notes: notes || null,
    });

    if (!success) {
      throw new Error("Failed to update certification in guest mode");
    }

    revalidatePath("/dashboard/certifications");
    redirect("/dashboard/certifications");
  }

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
    throw new Error(mapSupabaseError(error.message));
  }

  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}

export async function deleteCertification(id: string) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const success = await guestDeleteCertification(guestSid, id);
    if (!success) {
      throw new Error("Failed to delete certification in guest mode");
    }
    revalidatePath("/dashboard/certifications");
    return;
  }

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
    throw new Error(mapSupabaseError(error.message));
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
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    throw new Error("העלאת קבצים לא זמינה במצב אורח");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  const guestSid = await getGuestSessionId();
  if (guestSid) {
    return null;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.storage
    .from("cert-images")
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (error) return null;
  return data.signedUrl;
}

export async function deleteCertImage(filePath: string) {
  if (!filePath) return;

  const guestSid = await getGuestSessionId();
  if (guestSid) {
    return;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.storage.from("cert-images").remove([filePath]);
}
