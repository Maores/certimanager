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

export async function createEmployee(formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    guestCreateEmployee(guestSid, {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      employee_number: formData.get("employee_number") as string,
      department: formData.get("department") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      status: (formData.get("status") as string) || "פעיל",
      notes: (formData.get("notes") as string) || null,
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

  const { error } = await supabase.from("employees").insert({
    manager_id: user.id,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    employee_number: formData.get("employee_number") as string,
    department: formData.get("department") as string,
    phone: formData.get("phone") as string,
    email: formData.get("email") as string,
    status: (formData.get("status") as string) || "פעיל",
    notes: (formData.get("notes") as string) || null,
  });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  redirect("/dashboard/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const ok = guestUpdateEmployee(guestSid, id, {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      employee_number: formData.get("employee_number") as string,
      department: formData.get("department") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      status: (formData.get("status") as string) || "פעיל",
      notes: (formData.get("notes") as string) || null,
    });
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
    .update({
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      employee_number: formData.get("employee_number") as string,
      department: formData.get("department") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      status: (formData.get("status") as string) || "פעיל",
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id)
    .eq("manager_id", user.id);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
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
