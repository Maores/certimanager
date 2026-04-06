import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/types/database";
import { Search, UserPlus, Users } from "lucide-react";
import { EmployeeListClient } from "@/components/employees/employee-list-client";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployees, guestGetDepartments } from "@/lib/guest-store";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const { q, dept } = await searchParams;
  const guestSid = await getGuestSessionId();

  let departments: string[];
  let employees: Employee[] | null;

  if (guestSid) {
    departments = guestGetDepartments(guestSid);
    employees = guestGetEmployees(guestSid, q, dept);
  } else {
    const supabase = await createClient();

    // Fetch distinct departments for the filter
    const { data: allEmployees } = await supabase
      .from("employees")
      .select("department")
      .order("department");
    departments = [
      ...new Set(
        (allEmployees || [])
          .map((e) => e.department)
          .filter(Boolean)
      ),
    ] as string[];

    let query = supabase.from("employees").select("*").order("first_name");

    if (q) {
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,employee_number.ilike.%${q}%,department.ilike.%${q}%`
      );
    }

    if (dept) {
      query = query.eq("department", dept);
    }

    const { data } = await query;
    employees = data as Employee[] | null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">עובדים</h1>
        <Link
          href="/dashboard/employees/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover cursor-pointer"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <UserPlus className="h-4 w-4" />
          הוסף עובד
        </Link>
      </div>

      {/* Search + department filter */}
      <form method="GET" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="חיפוש עובד..."
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 pr-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring"
          />
          <button
            type="submit"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors cursor-pointer"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        <AutoSubmitSelect
          name="dept"
          defaultValue={dept ?? ""}
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-48"
        >
          <option value="">כל המחלקות</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </AutoSubmitSelect>
      </form>

      {!employees || employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted">לא נמצאו עובדים</p>
          <p className="mt-1 text-sm text-muted-foreground">
            התחל בהוספת עובד חדש למערכת
          </p>
          <Link
            href="/dashboard/employees/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            הוסף עובד
          </Link>
        </div>
      ) : (
        <EmployeeListClient employees={employees as Employee[]} />
      )}
    </div>
  );
}
