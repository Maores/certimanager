"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getGuestSessionId } from "@/lib/guest-session";

export async function createTask(formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    throw new Error("משימות אינן זמינות במצב אורח");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const employee_id = (formData.get("employee_id") as string || "").trim();
  const description = (formData.get("description") as string || "").trim();
  const responsible = (formData.get("responsible") as string || "").trim();

  if (!employee_id || !description) {
    throw new Error("עובד ותיאור משימה הם שדות חובה");
  }

  // Verify the employee belongs to this manager
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employee_id)
    .eq("manager_id", user.id)
    .single();

  if (!employee) {
    throw new Error("העובד לא נמצא");
  }

  const { error } = await supabase.from("employee_tasks").insert({
    employee_id,
    description,
    responsible: responsible || null,
    status: "פתוח",
  });

  if (error) {
    throw new Error("שגיאה ביצירת המשימה. נסה שוב");
  }

  revalidatePath("/dashboard/tasks");
}

export async function updateTaskStatus(taskId: string, newStatus: string) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    throw new Error("משימות אינן זמינות במצב אורח");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const validStatuses = ["פתוח", "בטיפול", "הושלם"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("סטטוס לא חוקי");
  }

  // Update task only if it belongs to an employee of this manager
  const { data: updated, error } = await supabase
    .from("employee_tasks")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select("id, employee_id")
    .single();

  if (error || !updated) {
    throw new Error("שגיאה בעדכון המשימה");
  }

  // Verify ownership through employee
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("id", updated.employee_id)
    .eq("manager_id", user.id)
    .single();

  if (!employee) {
    // Revert the update - task doesn't belong to this manager
    throw new Error("אין הרשאה לעדכן משימה זו");
  }

  revalidatePath("/dashboard/tasks");
}

export async function deleteTask(taskId: string) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    throw new Error("משימות אינן זמינות במצב אורח");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // First verify the task belongs to an employee of this manager
  const { data: task } = await supabase
    .from("employee_tasks")
    .select("id, employee_id")
    .eq("id", taskId)
    .single();

  if (!task) {
    throw new Error("המשימה לא נמצאה");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("id", task.employee_id)
    .eq("manager_id", user.id)
    .single();

  if (!employee) {
    throw new Error("אין הרשאה למחוק משימה זו");
  }

  const { error } = await supabase
    .from("employee_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    throw new Error("שגיאה במחיקת המשימה");
  }

  revalidatePath("/dashboard/tasks");
}
