import { createClient } from "@/lib/supabase/server";
import { getCertStatus, formatDateHe } from "@/types/database";
import type { CertStatus } from "@/types/database";
import Link from "next/link";
import { deleteCertification } from "./actions";
import { DeleteButton } from "@/components/ui/delete-button";

const statusConfig: Record<
  CertStatus,
  { label: string; bg: string; text: string }
> = {
  valid: { label: "בתוקף", bg: "bg-green-100", text: "text-green-800" },
  expiring_soon: {
    label: "פג בקרוב",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  expired: { label: "פג תוקף", bg: "bg-red-100", text: "text-red-800" },
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
        <h1 className="text-2xl font-bold text-gray-900">הסמכות</h1>
        <Link
          href="/dashboard/certifications/new"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <span>+</span>
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
            className="w-full pr-4 pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <input type="hidden" name="filter" value={currentFilter} />
          <button
            type="submit"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
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
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {filtered.length} הסמכות נמצאו
      </p>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-lg">לא נמצאו הסמכות</p>
          <p className="text-gray-400 text-sm mt-1">
            נסה לשנות את הסינון או להוסיף הסמכה חדשה
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    עובד
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סוג הסמכה
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    קובץ
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תאריך הנפקה
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תאריך תפוגה
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((cert: any) => {
                  const sc = statusConfig[cert.status as CertStatus];
                  return (
                    <tr key={cert.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {cert.employee_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {cert.cert_type_name}
                      </td>
                      <td className="px-6 py-4">
                        {cert.image_url ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            {cert.image_url.endsWith(".pdf") ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                            מצורף
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDateHe(cert.issue_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDateHe(cert.expiry_date)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/certifications/${cert.id}/edit`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
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
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {cert.employee_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {cert.cert_type_name}
                      </p>
                    </div>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                    >
                      {sc.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">הנפקה: </span>
                      <span className="text-gray-900">
                        {formatDateHe(cert.issue_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">תפוגה: </span>
                      <span className="text-gray-900">
                        {formatDateHe(cert.expiry_date)}
                      </span>
                    </div>
                  </div>

                  {cert.image_url && (
                    <div className="flex items-center gap-1 text-xs text-green-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      קובץ מצורף
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <Link
                      href={`/dashboard/certifications/${cert.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
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
