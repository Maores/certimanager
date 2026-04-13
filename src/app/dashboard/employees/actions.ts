"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGuestSessionId } from "@/lib/guest-session";
import {
  guestCreateEmployee,
  guestUpdateEmployee,
  guestDeleteEmployee,
  guestDeleteEmployees,
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

export async function createEmployee(formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const first_name = (formData.get("first_name") as string || "").trim();
    const last_name = (formData.get("last_name") as string || "").trim();
    const employee_number = (formData.get("employee_number") as string || "").trim();

    if (!first_name || !last_name || !employee_number) {
      throw new Error("שם פרטי, שם משפחה ומספר זהות/דרכון הם שדות חובה");
    }

    guestCreateEmployee(guestSid, {
      first_name,
      last_name,
      employee_number,
      department: (formData.get("department") as string || "").trim(),
      status: (formData.get("status") as string) || "פעיל",
      phone: (formData.get("phone") as string || "").trim(),
      email: (formData.get("email") as string || "").trim(),
      notes: (formData.get("notes") as string || "").trim() || null,
    });
    redirect("/dashboard/employees");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const first_name = (formData.get("first_name") as string || "").trim();
  const last_name = (formData.get("last_name") as string || "").trim();
  const employee_number = (formData.get("employee_number") as string || "").trim();

  if (!first_name || !last_name || !employee_number) {
    throw new Error("שם פרטי, שם משפחה ומספר זהות/דרכון הם שדות חובה");
  }

  const { error } = await supabase.from("employees").insert({
    manager_id: user.id,
    first_name,
    last_name,
    employee_number,
    department: (formData.get("department") as string || "").trim(),
    phone: (formData.get("phone") as string || "").trim(),
    email: (formData.get("email") as string || "").trim(),
    status: (formData.get("status") as string) || "פעיל",
    notes: (formData.get("notes") as string) || null,
  });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  redirect("/dashboard/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  const first_name = (formData.get("first_name") as string || "").trim();
  const last_name = (formData.get("last_name") as string || "").trim();
  const employee_number = (formData.get("employee_number") as string || "").trim();

  if (!first_name || !last_name || !employee_number) {
    throw new Error("שם פרטי, שם משפחה ומספר זהות/דרכון הם שדות חובה");
  }

  const updateData = {
    first_name,
    last_name,
    employee_number,
    department: (formData.get("department") as string || "").trim(),
    phone: (formData.get("phone") as string || "").trim(),
    email: (formData.get("email") as string || "").trim(),
    status: (formData.get("status") as string) || "פעיל",
    notes: (formData.get("notes") as string || "").trim() || null,
  };

  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const ok = guestUpdateEmployee(guestSid, id, updateData);
    if (!ok) {
      throw new Error("העובד לא נמצא");
    }
    redirect("/dashboard/employees");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: updated, error } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", id)
    .eq("manager_id", user.id)
    .select("id");

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  if (!updated || updated.length === 0) {
    throw new Error("הרשומה לא נמצאה");
  }

  redirect("/dashboard/employees");
}

export async function deleteEmployee(id: string) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const ok = guestDeleteEmployee(guestSid, id);
    if (!ok) {
      throw new Error("Employee not found");
    }
    redirect("/dashboard/employees");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("manager_id", user.id);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  redirect("/dashboard/employees");
}

export async function deleteEmployees(ids: string[]): Promise<{ count: number }> {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    if (!ids || ids.length === 0) {
      throw new Error("No employee IDs provided");
    }
    const count = guestDeleteEmployees(guestSid, ids);
    return { count };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!ids || ids.length === 0) {
    throw new Error("No employee IDs provided");
  }

  let deletedCount = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from("employees")
      .delete({ count: 'exact' })
      .in("id", batch)
      .eq("manager_id", user.id);

    if (error) {
      throw new Error(mapSupabaseError(error.message));
    }
    deletedCount += count ?? 0;
  }

  return { count: deletedCount };
}
