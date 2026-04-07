import { createClient } from "@/lib/supabase/server";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployeeCount, getGuestData } from "@/lib/guest-store";
import { getCertStatus, formatDateHe } from "@/types/database";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { ElementType } from "react";

const colorMap: Record<
  string,
  { bg: string; text: string; iconBg: string; icon: ElementType }
> = {
  blue: {
    bg: "bg-primary-light",
    text: "text-primary",
    iconBg: "bg-primary/10",
    icon: Users,
  },
  green: {
    bg: "bg-success-light",
    text: "text-success",
    iconBg: "bg-success/10",
    icon: CheckCircle,
  },
  yellow: {
    bg: "bg-warning-light",
    text: "text-warning",
    iconBg: "bg-warning/10",
    icon: AlertTriangle,
  },
  red: {
    bg: "bg-danger-light",
    text: "text-danger",
    iconBg: "bg-danger/10",
    icon: XCircle,
  },
};

export default async function DashboardPage() {
  const guestSid = await getGuestSessionId();

  let employeeCountVal: number;
  let certs: any[];

  if (guestSid) {
    employeeCountVal = guestGetEmployeeCount(guestSid);
    const data = getGuestData(guestSid);
    certs = data.certifications.map((cert: any) => {
      const emp = data.employees.find((e: any) => e.id === cert.employee_id);
      const ct = data.certTypes.find((t: any) => t.id === cert.cert_type_id);
      return {
        ...cert,
        employees: emp ? { first_name: emp.first_name, last_name: emp.last_name } : null,
        cert_types: ct ? { name: ct.name } : null,
      };
    }).sort((a: any, b: any) => (a.expiry_date || "").localeCompare(b.expiry_date || ""));
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { count } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("manager_id", user.id);
    employeeCountVal = count || 0;
    const { data: allCerts } = await supabase
      .from("certifications")
      .select("id, expiry_date, employee_id, cert_type_id, employees!inner(first_name, last_name, manager_id), cert_types(name)")
      .eq("employees.manager_id", user.id)
      .order("expiry_date", { ascending: true });
    certs = allCerts || [];
  }
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
    { label: "סה\"כ עובדים", value: employeeCountVal, color: "blue" },
    { label: "הסמכות בתוקף", value: validCount, color: "green" },
    { label: "פג תוקף בקרוב", value: expiringSoonCount, color: "yellow" },
    { label: "פג תוקף", value: expiredCount, color: "red" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          לוח בקרה
        </h1>
        <p className="text-xs sm:text-sm mt-1 text-muted">
          סקירה כללית של הסמכות העובדים
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const c = colorMap[stat.color];
          const Icon = c.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl p-3 sm:p-5 transition-shadow duration-200 border border-border bg-card"
              style={{ boxShadow: "var(--shadow-xs)" }}
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <div
                  className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${c.iconBg}`}
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${c.text}`} />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${c.text} ltr-nums`}>
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 text-muted">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expiring / expired list */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-foreground">
          הסמכות שפג תוקפן או יפוג בקרוב
        </h2>
        {expiringSoonList.length === 0 ? (
          <div
            className="rounded-xl p-10 text-center"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-3"
              style={{ backgroundColor: "var(--success-light)" }}
            >
              <CheckCircle className="w-6 h-6" style={{ color: "var(--success)" }} />
            </div>
            <p className="font-medium" style={{ color: "var(--foreground)" }}>
              הכל תקין
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              אין הסמכות שפג תוקפן או עומדות לפוג
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-x-auto"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th
                    className="text-right px-5 py-3 font-medium text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    עובד
                  </th>
                  <th
                    className="text-right px-5 py-3 font-medium text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    הסמכה
                  </th>
                  <th
                    className="text-right px-5 py-3 font-medium text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    תאריך תפוגה
                  </th>
                  <th
                    className="text-right px-5 py-3 font-medium text-sm"
                    style={{ color: "var(--muted)" }}
                  >
                    סטטוס
                  </th>
                </tr>
              </thead>
              <tbody>
                {expiringSoonList.map((row, i) => (
                  <tr
                    key={i}
                    className="transition-colors duration-150 hover:bg-card-hover"
                    style={{
                      borderBottom:
                        i < expiringSoonList.length - 1
                          ? "1px solid var(--border-light)"
                          : "none",
                    }}
                  >
                    <td
                      className="px-5 py-3.5 font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {row.employee}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: "var(--muted)" }}>
                      {row.cert}
                    </td>
                    <td
                      className="px-5 py-3.5 font-medium ltr-nums"
                      style={{ color: "var(--foreground)" }}
                    >
                      {formatDateHe(row.expires)}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.status === "expired" ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: "var(--danger-light)",
                            color: "var(--danger)",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "var(--danger)" }}
                          />
                          פג תוקף
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: "var(--warning-light)",
                            color: "var(--warning)",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "var(--warning)" }}
                          />
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
