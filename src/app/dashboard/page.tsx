import { createClient } from "@/lib/supabase/server";
import { getCertStatus, formatDateHe } from "@/types/database";
import Link from "next/link";

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch real counts
  const { count: employeeCount } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true });

  const { data: allCerts } = await supabase
    .from("certifications")
    .select("id, expiry_date, employee_id, cert_type_id, employees(first_name, last_name), cert_types(name)")
    .order("expiry_date", { ascending: true });

  const certs = allCerts || [];
  let validCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  const expiringSoonList: { employee: string; cert: string; expires: string; status: string }[] = [];

  for (const cert of certs) {
    const status = getCertStatus(cert.expiry_date);
    if (status === "valid") validCount++;
    else if (status === "expiring_soon") expiringSoonCount++;
    else if (status === "expired") expiredCount++;

    if (status === "expiring_soon" || status === "expired") {
      const emp = cert.employees as any;
      const ct = cert.cert_types as any;
      expiringSoonList.push({
        employee: emp ? `${emp.first_name} ${emp.last_name}` : "לא ידוע",
        cert: ct?.name || "לא ידוע",
        expires: cert.expiry_date,
        status,
      });
    }
  }

  const stats = [
    { label: "סה\"כ עובדים", value: employeeCount || 0, color: "blue" },
    { label: "הסמכות בתוקף", value: validCount, color: "green" },
    { label: "פג תוקף בקרוב", value: expiringSoonCount, color: "yellow" },
    { label: "פג תוקף", value: expiredCount, color: "red" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const c = colorMap[stat.color];
          return (
            <div
              key={stat.label}
              className={`rounded-xl border ${c.border} ${c.bg} p-5`}
            >
              <p className={`text-3xl font-bold ${c.text}`}>{stat.value}</p>
              <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Expiring / expired list */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          הסמכות שפג תוקפן או יפוג בקרוב
        </h2>
        {expiringSoonList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">אין הסמכות שפג תוקפן או עומדות לפוג</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    עובד
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    הסמכה
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    תאריך תפוגה
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    סטטוס
                  </th>
                </tr>
              </thead>
              <tbody>
                {expiringSoonList.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-900">{row.employee}</td>
                    <td className="px-4 py-3 text-gray-700">{row.cert}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatDateHe(row.expires)}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "expired" ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          פג תוקף
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          פג בקרוב
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
