import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGuestSessionId } from "@/lib/guest-session";
import { ClipboardList } from "lucide-react";
import { TasksClient } from "./tasks-client";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; responsible?: string }>;
}) {
  const { status: statusFilter, responsible: responsibleFilter } =
    await searchParams;
  const guestSid = await getGuestSessionId();

  if (guestSid) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">משימות</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <ClipboardList className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted">
            משימות אינן זמינות במצב אורח
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            התחבר כדי לנהל משימות עובדים
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch tasks with employee names.
  // Secondary sort by `id` makes the order stable for rows sharing a `created_at`
  // second — otherwise a status update can reshuffle sibling rows.
  let query = supabase
    .from("employee_tasks")
    .select(
      "id, employee_id, description, responsible, status, created_at, updated_at, employees!inner(id, first_name, last_name, manager_id)"
    )
    .eq("employees.manager_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (responsibleFilter) {
    query = query.eq("responsible", responsibleFilter);
  }

  const { data: tasks } = await query;

  // Fetch employees for the "new task" form
  const { data: employees } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("manager_id", user.id)
    .order("first_name");

  // Count by status + build responsible list (from unfiltered tasks so the
  // dropdown keeps the full option set regardless of the current filter).
  const { data: allTasks } = await supabase
    .from("employee_tasks")
    .select(
      "status, responsible, employees!inner(manager_id)"
    )
    .eq("employees.manager_id", user.id);

  const allResponsible = [
    ...new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allTasks || []).map((t: any) => t.responsible).filter(Boolean)
    ),
  ] as string[];

  const counts = {
    "פתוח": 0,
    "בטיפול": 0,
    "הושלם": 0,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (allTasks || []).forEach((t: any) => {
    if (t.status in counts) {
      counts[t.status as keyof typeof counts]++;
    }
  });

  // Transform tasks for client component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskList = (tasks || []).map((t: any) => {
    // Supabase !inner join returns employees as array or object depending on FK
    const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
    return {
      id: t.id,
      employee_id: t.employee_id,
      description: t.description,
      responsible: t.responsible,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
      employee_name: `${emp.first_name} ${emp.last_name}`,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeList = (employees || []).map((e: any) => ({
    id: e.id,
    name: `${e.first_name} ${e.last_name}`,
  }));

  return (
    <TasksClient
      tasks={taskList}
      employees={employeeList}
      responsibleList={allResponsible}
      counts={counts}
      statusFilter={statusFilter || ""}
      responsibleFilter={responsibleFilter || ""}
    />
  );
}
