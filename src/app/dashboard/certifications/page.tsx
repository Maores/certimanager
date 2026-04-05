import { createClient } from "@/lib/supabase/server";
import { getCertStatus, formatDateHe } from "@/types/database";
import type { CertStatus } from "@/types/database";
import Link from "next/link";
import { deleteCertification } from "./actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { Search, Plus, Paperclip, FileText, Image } from "lucide-react";

const statusConfig: Record<
  CertStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  valid: { label: "בתוקף", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  unknown: { label: "לא ידוע", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  expiring_soon: {
    label: "פג בקרוב",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  expired: { label: "פג תוקף", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

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
  searchParams: Promise<{ filter?: string; search?: string }>;
}) {
  const params = await searchParams;
  const currentFilter = (params.filter || "all") as FilterTab;
  const searchQuery = params.search || "";

  const supabase = await createClient();

  const { data: certifications, error } = await supabase
    .from("certifications")
    .select(
      `
      id,
      issue_date,
      expiry_date,
      image_url,
      notes,
      created_at,
      updated_at,
      employees ( id, first_name, last_name ),
      cert_types ( id, name )
    `
    )
    .order("expiry_date", { ascending: true });

  if (error) {
    return (
      <div className="text-red-600 p-4">
        שגיאה בטעינת הסמכות: {error.message}
      </div>
    );
  }

  // Transform and filter
  const allCerts = (certifications || []).map((cert: any) => ({
    ...cert,
    employee_name: cert.employees
      ? `${cert.employees.first_name} ${cert.employees.last_name}`
      : "לא ידוע",
    cert_type_name: cert.cert_types?.name || "לא ידוע",
    status: getCertStatus(cert.expiry_date),
  }));

  const filtered = allCerts.filter((cert) => {
    const matchesFilter =
      currentFilter === "all" || cert.status === currentFilter;
    const matchesSearch =
      !searchQuery ||
      cert.employee_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
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

      {/* Search */}
      <form className="max-w-md">
        <div className="relative">
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="חיפוש לפי שם עובד..."
            className="w-full pr-4 pl-10 py-2.5 rounded-lg text-sm transition-colors"
            style={{
              border: "1px solid #e2e8f0",
              outline: "none",
            }}
          />
          <input type="hidden" name="filter" value={currentFilter} />
          <button
            type="submit"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors"
            style={{ color: "#94a3b8" }}
          >
            <Search className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
          </button>
        </div>
      </form>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => {
          const isActive = currentFilter === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/dashboard/certifications?filter=${tab.key}${searchQuery ? `&search=${searchQuery}` : ""}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "text-white"
                  : "hover:text-[#0f172a]"
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

      {/* Cards grid */}
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
        <>
          {/* Desktop table */}
          <div
            className="hidden md:block rounded-xl overflow-hidden"
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    עובד
                  </th>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    סוג הסמכה
                  </th>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    קובץ
                  </th>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    תאריך הנפקה
                  </th>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    תאריך תפוגה
                  </th>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    סטטוס
                  </th>
                  <th className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#e2e8f0" }}>
                {filtered.map((cert: any) => {
                  const sc = statusConfig[cert.status as CertStatus];
                  return (
                    <tr
                      key={cert.id}
                      className="transition-colors duration-150"
                      style={{ cursor: "default" }}
                      onMouseEnter={undefined}
                    >
                      <td className="px-6 py-4 text-sm font-medium" style={{ color: "#0f172a" }}>
                        {cert.employee_name}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>
                        {cert.cert_type_name}
                      </td>
                      <td className="px-6 py-4">
                        {cert.image_url ? (
                          <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                            {cert.image_url.endsWith(".pdf") ? (
                              <FileText className="h-3.5 w-3.5" />
                            ) : (
                              <Image className="h-3.5 w-3.5" />
                            )}
                            מצורף
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>
                        {formatDateHe(cert.issue_date)}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>
                        {formatDateHe(cert.expiry_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/certifications/${cert.id}/edit`}
                            className="text-sm font-medium transition-colors"
                            style={{ color: "#2563eb" }}
                          >
                            עריכה
                          </Link>
                          <DeleteButton
                            action={async () => {
                              "use server";
                              await deleteCertification(cert.id);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((cert: any) => {
              const sc = statusConfig[cert.status as CertStatus];
              return (
                <div
                  key={cert.id}
                  className="rounded-xl p-4 space-y-3 transition-colors duration-150"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold" style={{ color: "#0f172a" }}>
                        {cert.employee_name}
                      </h3>
                      <p className="text-sm" style={{ color: "#64748b" }}>
                        {cert.cert_type_name}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span style={{ color: "#94a3b8" }}>הנפקה: </span>
                      <span style={{ color: "#0f172a" }}>
                        {formatDateHe(cert.issue_date)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#94a3b8" }}>תפוגה: </span>
                      <span style={{ color: "#0f172a" }}>
                        {formatDateHe(cert.expiry_date)}
                      </span>
                    </div>
                  </div>

                  {cert.image_url && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                      <Paperclip className="h-3.5 w-3.5" />
                      קובץ מצורף
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                    <Link
                      href={`/dashboard/certifications/${cert.id}/edit`}
                      className="text-sm font-medium transition-colors"
                      style={{ color: "#2563eb" }}
                    >
                      עריכה
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await deleteCertification(cert.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm font-medium transition-colors"
                        style={{ color: "#dc2626" }}
                      >
                        מחיקה
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
