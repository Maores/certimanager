import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { CourseCandidate } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import { Search, UserPlus, Upload, GraduationCap } from "lucide-react";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";

const PAGE_SIZE = 25;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cert_type?: string; status?: string; page?: string }>;
}) {
  const { q, cert_type, status: statusFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch cert types for filter
  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("id, name")
    .eq("manager_id", user.id)
    .order("name");

  // Build candidates query
  let query = supabase
    .from("course_candidates")
    .select("*, cert_types(name)")
    .eq("manager_id", user.id)
    .order("created_at", { ascending: false });

  if (q) {
    const safeQ = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,");
    query = query.or(
      `first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,id_number.ilike.%${safeQ}%`
    );
  }

  if (cert_type) {
    query = query.eq("cert_type_id", cert_type);
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  // Count query
  let countQuery = supabase
    .from("course_candidates")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", user.id);
  if (q) {
    const safeQ = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,");
    countQuery = countQuery.or(
      `first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,id_number.ilike.%${safeQ}%`
    );
  }
  if (cert_type) countQuery = countQuery.eq("cert_type_id", cert_type);
  if (statusFilter) countQuery = countQuery.eq("status", statusFilter);
  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  // Apply pagination
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data } = await query;

  // Cross-reference with employees table to set is_employee flag
  const idNumbers = (data || []).map((c: Record<string, unknown>) => String(c.id_number));
  let employeeIdSet = new Set<string>();
  if (idNumbers.length > 0) {
    const { data: empData } = await supabase
      .from("employees")
      .select("employee_number")
      .eq("manager_id", user.id)
      .in("employee_number", idNumbers);
    employeeIdSet = new Set((empData || []).map((e) => e.employee_number));
  }

  const candidates: CourseCandidate[] = (data || []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    manager_id: c.manager_id as string,
    first_name: c.first_name as string,
    last_name: c.last_name as string,
    id_number: c.id_number as string,
    phone: c.phone as string | null,
    city: c.city as string | null,
    cert_type_id: c.cert_type_id as string,
    cert_type_name: (c.cert_types as Record<string, unknown> | null)?.name as string | undefined,
    status: c.status as CourseCandidate["status"],
    notes: c.notes as string | null,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
    is_employee: employeeIdSet.has(c.id_number as string),
  }));

  // Build pagination URL helper
  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cert_type) params.set("cert_type", cert_type);
    if (statusFilter) params.set("status", statusFilter);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/dashboard/candidates${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">מועמדים לקורס</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/candidates/import"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50 cursor-pointer"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <Upload className="h-4 w-4" />
            ייבוא מקובץ
          </Link>
          <Link
            href="/dashboard/candidates/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover cursor-pointer"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <UserPlus className="h-4 w-4" />
            הוסף מועמד
          </Link>
        </div>
      </div>

      {/* Search + filters */}
      <form method="GET" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="חיפוש מועמד..."
            aria-label="חיפוש מועמד"
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
          name="cert_type"
          defaultValue={cert_type ?? ""}
          aria-label="סינון לפי סוג הסמכה"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-48"
        >
          <option value="">כל ההסמכות</option>
          {(certTypes || []).map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
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
          {CANDIDATE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </AutoSubmitSelect>
      </form>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted">לא נמצאו מועמדים</p>
          <p className="mt-1 text-sm text-muted-foreground">
            התחל בהוספת מועמד חדש או ייבוא מקובץ
          </p>
          <Link
            href="/dashboard/candidates/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            הוסף מועמד
          </Link>
        </div>
      ) : (
        <>
          <CandidatesTable candidates={candidates} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-gray-50 transition-colors"
                >
                  הקודם
                </Link>
              )}
              <span className="text-sm text-muted-foreground">
                עמוד {page} מתוך {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-gray-50 transition-colors"
                >
                  הבא
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
