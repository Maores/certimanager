import { requireUser } from "@/lib/supabase/auth";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetCertTypes, guestGetCertifications, getGuestData } from "@/lib/guest-store";
import { getCertStatus, type CertStatus, type CertRow } from "@/types/database";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { CertificationsList } from "@/components/certifications/certifications-list";

type FilterTab = "all" | CertStatus;

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "valid", label: "בתוקף" },
  { key: "expiring_soon", label: "פג בקרוב" },
  { key: "expired", label: "פג תוקף" },
];

export default async function CertificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string; dept?: string; type?: string }>;
}) {
  const params = await searchParams;
  const currentFilter = (params.filter || "all") as FilterTab;
  const searchQuery = params.search || "";
  // type=A,B,C and dept=X,Y — comma-separated lists. Single-value links
  // (?type=A, ?dept=X) remain valid for backward compat with old bookmarks.
  const deptFilter = params.dept || "";
  const deptFilters = deptFilter.split(",").filter(Boolean);
  const typeFilter = params.type || "";
  const typeFilters = typeFilter.split(",").filter(Boolean);

  const guestSid = await getGuestSessionId();

  let certTypes: { id: string; name: string }[] | null;
  let departments: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let certifications: any[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any = null;

  if (guestSid) {
    certTypes = guestGetCertTypes(guestSid);
    const data = getGuestData(guestSid);
    departments = [...new Set(data.employees.map((e) => e.department).filter(Boolean))].sort() as string[];
    certifications = guestGetCertifications(guestSid);
  } else {
    const { user, supabase } = await requireUser();

    const [certTypesResult, deptResult] = await Promise.all([
      supabase.from("cert_types").select("id, name").eq("manager_id", user.id).order("name"),
      supabase.from("employees").select("department").eq("manager_id", user.id).order("department"),
    ]);

    certTypes = certTypesResult.data;
    const deptData = deptResult.data;
    departments = [
      ...new Set(
        (deptData || []).map((e) => e.department).filter(Boolean)
      ),
    ] as string[];

    let dataQuery = supabase
      .from("certifications")
      .select(
        `
        id,
        issue_date,
        expiry_date,
        next_refresh_date,
        image_url,
        image_filename,
        notes,
        created_at,
        updated_at,
        cert_type_id,
        employees!inner ( id, first_name, last_name, department, manager_id ),
        cert_types ( id, name )
      `
      )
      .eq("employees.manager_id", user.id);

    // Push dept + cert-type filters into the supabase query so the server
    // returns the smallest possible set. Status (computed from dates) and
    // search (across joined+concatenated columns) stay as in-memory steps.
    if (typeFilters.length > 0) {
      dataQuery = dataQuery.in("cert_type_id", typeFilters);
    }
    if (deptFilters.length > 0) {
      dataQuery = dataQuery.in("employees.department", deptFilters);
    }

    const result = await dataQuery.order("expiry_date", { ascending: true });

    certifications = result.data;
    error = result.error;
  }

  if (error) {
    return (
      <div className="text-red-600 p-4">
        שגיאה בטעינת הסמכות: {error.message}
      </div>
    );
  }

  // Transform and filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCerts: CertRow[] = (certifications || []).map((cert: any) => ({
    id: cert.id,
    employee_name: cert.employees
      ? `${cert.employees.first_name} ${cert.employees.last_name}`
      : "לא ידוע",
    employee_department: cert.employees?.department || "",
    cert_type_id: cert.cert_type_id,
    cert_type_name: cert.cert_types?.name || "לא ידוע",
    issue_date: cert.issue_date,
    expiry_date: cert.expiry_date,
    next_refresh_date: cert.next_refresh_date,
    image_url: cert.image_url,
    image_filename: cert.image_filename ?? null,
    status: getCertStatus(cert.expiry_date, cert.next_refresh_date),
  }));

  // Guest mode keeps in-memory filtering (no supabase query). For supabase
  // mode, dept + cert-type are already filtered server-side above; only
  // status (computed) and search (joined string) remain.
  const filtered = allCerts.filter((cert) => {
    const matchesFilter =
      currentFilter === "all" || cert.status === currentFilter;
    const matchesSearch =
      !searchQuery ||
      cert.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.cert_type_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      !guestSid || deptFilters.length === 0 || deptFilters.includes(cert.employee_department);
    const matchesType =
      !guestSid || typeFilters.length === 0 || typeFilters.includes(cert.cert_type_id);
    return matchesFilter && matchesSearch && matchesDept && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>
            הסמכות
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            ניהול ומעקב אחר הסמכות העובדים
          </p>
        </div>
        <Link
          href="/dashboard/certifications/new"
          className="inline-flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-lg transition-colors text-sm font-medium"
          style={{ backgroundColor: "#2563eb", boxShadow: "var(--shadow-sm)" }}
        >
          <Plus className="h-4 w-4" />
          <span>הוסף הסמכה</span>
        </Link>
      </div>

      {/* Search + filters */}
      <form className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="חיפוש לפי שם עובד או הסמכה..."
            aria-label="חיפוש הסמכות"
            className="w-full pr-4 pl-10 py-2.5 rounded-lg text-sm border border-border bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring"
          />
          <input type="hidden" name="filter" value={currentFilter} />
          <button
            type="submit"
            aria-label="חיפוש"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors cursor-pointer"
          >
            <Search className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
          </button>
        </div>
        <MultiSelectFilter
          name="dept"
          selected={deptFilters}
          options={departments.map((d) => ({ value: d, label: d }))}
          placeholder="כל המחלקות"
          ariaLabel="סינון לפי מחלקה"
          className="sm:w-44"
        />
        <MultiSelectFilter
          name="type"
          selected={typeFilters}
          options={(certTypes || []).map((ct) => ({ value: ct.id, label: ct.name }))}
          placeholder="כל סוגי ההסמכה"
          ariaLabel="סינון לפי סוג הסמכה"
          className="sm:w-44"
        />
      </form>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => {
          const isActive = currentFilter === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/dashboard/certifications?filter=${tab.key}${searchQuery ? `&search=${searchQuery}` : ""}${deptFilter ? `&dept=${deptFilter}` : ""}${typeFilter ? `&type=${typeFilter}` : ""}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                isActive ? "text-white" : "hover:text-[#0f172a]"
              }`}
              style={
                isActive
                  ? { backgroundColor: "#2563eb", color: "#fff" }
                  : {
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      color: "#64748b",
                    }
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-sm" style={{ color: "#94a3b8" }}>
        {filtered.length} הסמכות נמצאו
      </p>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-lg" style={{ color: "#64748b" }}>
            לא נמצאו הסמכות
          </p>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            נסה לשנות את הסינון או להוסיף הסמכה חדשה
          </p>
        </div>
      ) : (
        <CertificationsList certs={filtered} isGuest={Boolean(guestSid)} />
      )}
    </div>
  );
}
