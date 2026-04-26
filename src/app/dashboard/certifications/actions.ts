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
    if (msg.includes("employee_number")) return "מספר זהות/דרכון כבר קיים במערכת";
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
    const next_refresh_date = formData.get("next_refresh_date") as string;
    const image_url = formData.get("image_url") as string | null;
    const image_filename = formData.get("image_filename") as string | null;
    const notes = formData.get("notes") as string | null;

    if (issue_date && expiry_date && expiry_date < issue_date) {
      throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
    }

    // Check for existing valid certification with same employee_id + cert_type_id
    const guestData = getGuestData(guestSid);
    const today = new Date().toISOString().split("T")[0];
    const existingCert = guestData.certifications.find(
      (c) =>
        c.employee_id === employee_id &&
        c.cert_type_id === cert_type_id &&
        ((c.expiry_date && c.expiry_date > today) ||
         (c.next_refresh_date && c.next_refresh_date > today))
    );
    if (existingCert) {
      throw new Error("לעובד זה כבר יש הסמכה בתוקף מסוג זה");
    }

    await guestCreateCertification(guestSid, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: next_refresh_date || null,
      image_url: image_url || null,
      image_filename: image_filename || null,
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
  const next_refresh_date = formData.get("next_refresh_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const image_filename = formData.get("image_filename") as string | null;
  const notes = formData.get("notes") as string | null;

  if (issue_date && expiry_date && expiry_date < issue_date) {
    throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
  }

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
    .or(`expiry_date.gt.${today},next_refresh_date.gt.${today}`)
    .limit(1);

  if (existingCerts && existingCerts.length > 0) {
    throw new Error("לעובד זה כבר יש הסמכה בתוקף מסוג זה");
  }

  const { error } = await supabase.from("certifications").insert({
    employee_id,
    cert_type_id,
    issue_date: issue_date || null,
    expiry_date: expiry_date || null,
    next_refresh_date: next_refresh_date || null,
    image_url: image_url || null,
    image_filename: image_filename || null,
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
    const next_refresh_date = formData.get("next_refresh_date") as string;
    const image_url = formData.get("image_url") as string | null;
    const image_filename = formData.get("image_filename") as string | null;
    const notes = formData.get("notes") as string | null;

    if (issue_date && expiry_date && expiry_date < issue_date) {
      throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
    }

    const success = await guestUpdateCertification(guestSid, id, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: next_refresh_date || null,
      image_url: image_url || null,
      image_filename: image_filename || null,
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
  const next_refresh_date = formData.get("next_refresh_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const image_filename = formData.get("image_filename") as string | null;
  const notes = formData.get("notes") as string | null;

  if (issue_date && expiry_date && expiry_date < issue_date) {
    throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
  }

  // Verify new employee belongs to the current manager
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employee_id)
    .eq("manager_id", user.id)
    .single();
  if (!emp) throw new Error("Unauthorized");

  // Verify new cert type belongs to the current manager
  const { data: ct } = await supabase
    .from("cert_types")
    .select("id")
    .eq("id", cert_type_id)
    .eq("manager_id", user.id)
    .single();
  if (!ct) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("certifications")
    .update({
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: next_refresh_date || null,
      image_url: image_url || null,
      image_filename: image_filename || null,
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
    .select("id, image_url, employee_id, employees!inner(manager_id)")
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

  // Clean up uploaded file from storage
  if (cert.image_url) {
    const path = cert.image_url.split("/cert-images/")[1];
    if (path) {
      await supabase.storage.from("cert-images").remove([path]);
    }
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

  // Return the storage path (private bucket — caller signs on demand)
  // alongside the original filename so the list UI can show something
  // recognizable instead of a generic "מצורף" badge.
  return { path: filePath, filename: file.name };
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

  // Verify file belongs to a certification owned by the current user
  const { data: ownerCheck } = await supabase
    .from("certifications")
    .select("id, employees!inner(manager_id)")
    .eq("image_url", filePath)
    .eq("employees.manager_id", user.id)
    .limit(1);
  if (!ownerCheck || ownerCheck.length === 0) return null;

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

  // Verify file belongs to a certification owned by the current user
  const { data: ownerCheck } = await supabase
    .from("certifications")
    .select("id, employees!inner(manager_id)")
    .eq("image_url", filePath)
    .eq("employees.manager_id", user.id)
    .limit(1);
  if (!ownerCheck || ownerCheck.length === 0) return;

  await supabase.storage.from("cert-images").remove([filePath]);
}

export async function deleteCertifications(ids: string[]): Promise<{
  deleted: number;
  errors: string[];
}> {
  const result = { deleted: 0, errors: [] as string[] };
  if (!Array.isArray(ids) || ids.length === 0) return result;

  const guestSid = await getGuestSessionId();
  if (guestSid) {
    return {
      deleted: 0,
      errors: ["מחיקה מרובה אינה זמינה במצב אורח"],
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const imagePaths: string[] = [];

  for (const id of ids) {
    const { data: cert } = await supabase
      .from("certifications")
      .select("id, image_url, employees!inner(manager_id)")
      .eq("id", id)
      .single();

    // Missing row OR cross-manager row: silent no-op per spec.
    // Count as deleted because the end state (row inaccessible to this user) is correct.
    const managerId =
      cert && (cert.employees as unknown as { manager_id: string } | null)?.manager_id;
    if (!cert || managerId !== user.id) {
      result.deleted++;
      continue;
    }

    const { error } = await supabase
      .from("certifications")
      .delete()
      .eq("id", id);

    if (error) {
      result.errors.push(`${id}: ${mapSupabaseError(error.message)}`);
      continue;
    }

    result.deleted++;
    if (cert.image_url) {
      const path = cert.image_url.includes("/cert-images/")
        ? cert.image_url.split("/cert-images/")[1]
        : cert.image_url;
      if (path) imagePaths.push(path);
    }
  }

  // Best-effort storage cleanup. DB is authoritative; orphaned files are acceptable.
  if (imagePaths.length > 0) {
    try {
      await supabase.storage.from("cert-images").remove(imagePaths);
    } catch {
      // Intentionally swallow — orphan is preferable to a failed bulk delete.
    }
  }

  revalidatePath("/dashboard/certifications");
  return result;
}
