import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import type { CourseCandidate } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import { Search, UserPlus, Upload, GraduationCap } from "lucide-react";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { LeadsTable } from "@/components/candidates/leads-table";
import {
  CandidatesTabs,
  type CandidatesTabKey,
} from "@/components/candidates/candidates-tabs";
import { SyncLeadsButton } from "@/components/candidates/sync-leads-button";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

const PAGE_SIZE = 25;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cert_type?: string;
    status?: string;
    page?: string;
    tab?: string;
  }>;
}) {
  const {
    q,
    cert_type,
    status: statusFilter,
    page: pageParam,
    tab,
  } = await searchParams;
  const activeTab: CandidatesTabKey = tab === "candidates" ? "candidates" : "leads";
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const certTypeFilters = (cert_type || "").split(",").filter(Boolean);
  const statusFilters = (statusFilter || "").split(",").filter(Boolean);

  const { user, supabase } = await requireUser();

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("id, name")
    .eq("manager_id", user.id)
    .order("name");

  const { count: leadsCount } = await supabase
    .from("course_candidates")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", user.id)
    .is("cert_type_id", null);

  const { count: candidatesCount } = await supabase
    .from("course_candidates")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", user.id)
    .neq("status", "הוסמך")
    .not("cert_type_id", "is", null);

  let query = supabase
    .from("course_candidates")
    .select("*, cert_types(name)")
    .eq("manager_id", user.id)
    .order("created_at", { ascending: false });

  if (activeTab === "leads") {
    query = query.is("cert_type_id", null);
  } else {
    query = query.neq("status", "הוסמך").not("cert_type_id", "is", null);
    if (q) {
      const safeQ = q
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/,/g, "\\,");
      query = query.or(
        `first_name.ilike.%${safeQ}%,last_name.ilike.%${safeQ}%,id_number.ilike.%${safeQ}%`
      );
    }
    if (certTypeFilters.length > 0) query = query.in("cert_type_id", certTypeFilters);
    if (statusFilters.length > 0) query = query.in("status", statusFilters);
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  }

  const { data } = await query;

  const idNumbers = (data || []).map((c: Record<string, unknown>) => String(c.id_number));
  let employeeIdSet = new Set<string>();
  if (activeTab === "candidates" && idNumbers.length > 0) {
    const { data: empData } = await supabase
      .from("employees")
      .select("employee_number")
      .eq("manager_id", user.id)
      .in("employee_number", idNumbers);
    employeeIdSet = new Set((empData || []).map((e) => e.employee_number));
  }

  const rows: CourseCandidate[] = (data || []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    manager_id: c.manager_id as string,
    first_name: c.first_name as string,
    last_name: (c.last_name as string) ?? "",
    id_number: c.id_number as string,
    phone: c.phone as string | null,
    city: c.city as string | null,
    cert_type_id: (c.cert_type_id as string | null) ?? null,
    cert_type_name: (c.cert_types as Record<string, unknown> | null)?.name as
      | string
      | undefined,
    status: c.status as CourseCandidate["status"],
    notes: (c.notes as string | null) ?? null,
    police_clearance_status:
      (c.police_clearance_status as CourseCandidate["police_clearance_status"]) ??
      "לא נשלח",
    read_at: (c.read_at as string | null) ?? null,
    created_at: c.created_at as string,
    updated_at: c.updated_at as string,
    is_employee: employeeIdSet.has(c.id_number as string),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">מועמדים לקורס</h1>
        <div className="flex items-center gap-2">
          <SyncLeadsButton />
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

      <CandidatesTabs
        activeTab={activeTab}
        leadsCount={leadsCount ?? 0}
        candidatesCount={candidatesCount ?? 0}
      />

      {activeTab === "candidates" && (
        <form method="GET" className="flex flex-col sm:flex-row gap-3">
          <input type="hidden" name="tab" value="candidates" />
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
          <MultiSelectFilter
            name="cert_type"
            selected={certTypeFilters}
            options={(certTypes || []).map((ct) => ({ value: ct.id, label: ct.name }))}
            placeholder="כל ההסמכות"
            ariaLabel="סינון לפי סוג הסמכה"
            className="sm:w-48"
          />
          <MultiSelectFilter
            name="status"
            selected={statusFilters}
            options={CANDIDATE_STATUSES.map((s) => ({ value: s, label: s }))}
            placeholder="כל הסטטוסים"
            ariaLabel="סינון לפי סטטוס"
            className="sm:w-48"
          />
        </form>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted">
            {activeTab === "leads" ? "לא נמצאו לידים" : "לא נמצאו מועמדים"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "leads"
              ? "לחץ על 'סנכרן לידים מהאתר' כדי למשוך את הרשימה האחרונה"
              : "התחל בהוספת מועמד חדש או ייבוא מקובץ"}
          </p>
        </div>
      ) : activeTab === "leads" ? (
        <LeadsTable
          leads={rows}
          certTypes={(certTypes || []).map((ct) => ({ id: ct.id, name: ct.name }))}
        />
      ) : (
        <CandidatesTable candidates={rows} />
      )}
    </div>
  );
}
