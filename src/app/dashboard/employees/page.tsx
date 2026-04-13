import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Employee } from "@/types/database";
import { Search, UserPlus, Users } from "lucide-react";
import { EmployeeListClient } from "@/components/employees/employee-list-client";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployees, guestGetDepartments } from "@/lib/guest-store";

const PAGE_SIZE = 25;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; status?: string; page?: string }>;
}) {
  const { q, dept, status: statusFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const guestSid = await getGuestSessionId();

  let departments: string[];
  let employees: Employee[] | null;
  let totalPages = 1;

  if (guestSid) {
    departments = guestGetDepartments(guestSid);
    let allGuest = guestGetEmployees(guestSid, q, dept);
    if (statusFilter) {
      allGuest = allGuest.filter((e) => e.status === statusFilter);
    }
    totalPages = Math.ceil(allGuest.length / PAGE_SIZE);
    employees = allGuest.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Fetch distinct departments for the filter
    const { data: allEmployees } = await supabase
      .from("employees")
      .select("department")
      .eq("manager_id", user.id)
      .order("department");
    departments = [
      ...new Set(
        (allEmployees || [])
          .map((e) => e.department)
          .filter(Boolean)
      ),
    ] as string[];

    let query = supabase.from("employees").select("*").eq("manager_id", user.id).order("first_name");

    if (q) {
      // Escape PostgREST special characters to prevent parse errors.
      // Order matters: backslash must be escaped first.
      const safeQ = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,");
      query = query.or(
        `first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,employee_number.ilike.%${safeQ}%,department.ilike.%${safeQ}%`
      );
    }

    if (dept) {
      query = query.eq("department", dept);
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    // Count query (same filters, head-only)
    let countQuery = supabase.from("employees").select("*", { count: "exact", head: true }).eq("manager_id", user.id);
    if (q) {
      const safeQ = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,");
      countQuery = countQuery.or(
        `first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,employee_number.ilike.%${safeQ}%,department.ilike.%${safeQ}%`
      );
    }
    if (dept) countQuery = countQuery.eq("department", dept);
    if (statusFilter) countQuery = countQuery.eq("status", statusFilter);
    const { count } = await countQuery;
    totalPages = Math.ceil((count || 0) / PAGE_SIZE);

    // Apply pagination range
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

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
            aria-label="חיפוש עובד"
            className="w-full rounded-lg border border-border bg-white px-4 py-2.5 pr-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring"
          />
          <button
            type="submit"
            aria-label="חיפוש"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors cursor-pointer"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        <AutoSubmitSelect
          name="dept"
          defaultValue={dept ?? ""}
          aria-label="סינון לפי מחלקה"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-48"
        >
          <option value="">כל המחלקות</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect
          name="status"
          defaultValue={statusFilter ?? ""}
          aria-label="סינון לפי סטטוס"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-48"
        >
          <option value="">כל הסטטוסים</option>
          <option value="פעיל">פעיל</option>
          <option value="לא פעיל">לא פעיל</option>
          <option value={'חל"ת'}>{'חל"ת'}</option>
          <option value="מחלה">מחלה</option>
          <option value="ללא הסמכה - לבירור">ללא הסמכה - לבירור</option>
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
        <EmployeeListClient employees={employees as Employee[]} page={page} totalPages={totalPages} />
      )}
    </div>
  );
}
