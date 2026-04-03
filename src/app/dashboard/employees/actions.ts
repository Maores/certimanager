"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createEmployee(formData: FormData) {
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
    notes: (formData.get("notes") as string) || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
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
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id)
    .eq("manager_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/dashboard/employees");
}

export async function deleteEmployee(id: string) {
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
    throw new Error(error.message);
  }

  redirect("/dashboard/employees");
}
