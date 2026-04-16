import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { getGuestSessionId } from "@/lib/guest-session";
import { getGuestData } from "@/lib/guest-store";
import { getCertStatus } from "@/types/database";
import {
  Users,
  Award,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Building2,
  UserX,
  Activity,
} from "lucide-react";

export default async function ReportsPage() {
  const guestSid = await getGuestSessionId();

  let allEmployees: any[];
  let allCertsRaw: any[];
  let allCertTypes: any[];

  if (guestSid) {
    const data = getGuestData(guestSid);
    allEmployees = data.employees;
    allCertTypes = data.certTypes;
    allCertsRaw = data.certifications.map((cert: any) => {
      const emp = data.employees.find((e: any) => e.id === cert.employee_id);
      const ct = data.certTypes.find((t: any) => t.id === cert.cert_type_id);
      return {
        ...cert,
        employees: emp ? { first_name: emp.first_name, last_name: emp.last_name, department: emp.department } : null,
        cert_types: ct ? { name: ct.name } : null,
      };
    }).sort((a: any, b: any) => (a.expiry_date || "").localeCompare(b.expiry_date || ""));
  } else {
    const user = await getAuthenticatedUser();
    if (!user) redirect("/login");
    const supabase = await createClient();

    const [
      { data: employees },
      { data: certifications },
      { data: certTypes },
    ] = await Promise.all([
      supabase.from("employees").select("id, first_name, last_name, department, status").eq("manager_id", user.id),
      supabase
        .from("certifications")
        .select(
          "id, expiry_date, cert_type_id, employee_id, employees!inner(first_name, last_name, department, manager_id), cert_types(name)"
        )
        .eq("employees.manager_id", user.id)
        .order("expiry_date", { ascending: true }),
      supabase.from("cert_types").select("id, name").eq("manager_id", user.id),
    ]);
    allEmployees = employees || [];
    allCertsRaw = certifications || [];
    allCertTypes = certTypes || [];
  }

  const allCerts = (allCertsRaw).map((c: any) => ({
    ...c,
    status: getCertStatus(c.expiry_date),
    employee_name: c.employees
      ? `${c.employees.first_name} ${c.employees.last_name}`
      : "לא ידוע",
    employee_dept: c.employees?.department || "ללא מחלקה",
    cert_type_name: c.cert_types?.name || "לא ידוע",
  }));

  // ── Compliance overview ──
  const totalEmployees = allEmployees.length;
  const totalCerts = allCerts.length;
  const expiringCount = allCerts.filter(
    (c: any) => c.status === "expiring_soon"
  ).length;
  const expiredCount = allCerts.filter(
    (c: any) => c.status === "expired"
  ).length;
  // ── Expiring timeline ──
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const endOf3Months = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  const expiringThisMonth = allCerts.filter((c: any) => {
    if (!c.expiry_date) return false;
    const d = new Date(c.expiry_date);
    return d >= now && d <= endOfMonth;
  });
  const expiringNextMonth = allCerts.filter((c: any) => {
    if (!c.expiry_date) return false;
    const d = new Date(c.expiry_date);
    return d > endOfMonth && d <= endOfNextMonth;
  });
  const expiring3Months = allCerts.filter((c: any) => {
    if (!c.expiry_date) return false;
    const d = new Date(c.expiry_date);
    return d > endOfNextMonth && d <= endOf3Months;
  });

  // ── Department breakdown ──
  const departments = [
    ...new Set(allEmployees.map((e) => e.department).filter(Boolean)),
  ];
  const deptStats = departments.map((dept) => {
    const deptEmployees = allEmployees.filter((e) => e.department === dept);
    const deptCerts = allCerts.filter((c: any) => c.employee_dept === dept);
    const deptValid = deptCerts.filter(
      (c: any) => c.status === "valid"
    ).length;
    const deptExpiring = deptCerts.filter(
      (c: any) => c.status === "expiring_soon"
    ).length;
    const deptExpired = deptCerts.filter(
      (c: any) => c.status === "expired"
    ).length;
    return {
      name: dept,
      employees: deptEmployees.length,
      total: deptCerts.length,
      valid: deptValid,
      expiring: deptExpiring,
      expired: deptExpired,
    };
  });

  // ── Employee status breakdown ──
  const statusLabels = ["פעיל", "לא פעיל", "ללא הסמכה - לבירור", "חל\"ת", "מחלה"] as const;
  const statusColorMap: Record<string, { bg: string; text: string; dot: string; barBg: string }> = {
    "פעיל": { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", barBg: "bg-green-500" },
    "לא פעיל": { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", barBg: "bg-gray-400" },
    "חל\"ת": { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500", barBg: "bg-yellow-500" },
    "מחלה": { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", barBg: "bg-orange-500" },
    "ללא הסמכה - לבירור": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", barBg: "bg-red-500" },
  };
  const statusCounts = statusLabels.map((label) => ({
    label,
    count: allEmployees.filter((e) => e.status === label).length,
  })).filter((s) => s.count > 0);

  // ── Employees missing certifications ──
  const employeesWithCertCount = allEmployees.map((emp) => {
    const empCerts = allCerts.filter(
      (c: any) => c.employee_id === emp.id
    );
    const empCertTypeIds = new Set(empCerts.map((c: any) => c.cert_type_id));
    const missing = allCertTypes.filter(
      (ct) => !empCertTypeIds.has(ct.id)
    );
    return {
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      department: emp.department || "ללא מחלקה",
      certCount: empCerts.length,
      missingTypes: missing.map((ct) => ct.name),
    };
  });
  const employeesMissing = employeesWithCertCount.filter(
    (e) => e.missingTypes.length > 0
  );

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          דוחות
        </h1>
        <p className="text-xs sm:text-sm mt-1 text-muted">
          סקירת הסמכות וסטטיסטיקות
        </p>
      </div>

      {/* ── Section A: Compliance Overview Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Users}
          label="סה״כ עובדים"
          value={totalEmployees}
          color="blue"
        />
        <StatCard
          icon={Award}
          label="סה״כ הסמכות"
          value={totalCerts}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="פג בקרוב"
          value={expiringCount}
          color="yellow"
        />
        <StatCard
          icon={XCircle}
          label="פג תוקף"
          value={expiredCount}
          color="red"
        />
      </div>

      {/* ── Section B: Expiring Timeline ── */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          ציר זמן תפוגה
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <TimelineBucket
            title="החודש"
            items={expiringThisMonth}
            color="red"
          />
          <TimelineBucket
            title="חודש הבא"
            items={expiringNextMonth}
            color="yellow"
          />
          <TimelineBucket
            title="3 חודשים"
            items={expiring3Months}
            color="blue"
          />
        </div>
      </section>

      {/* ── Section C: Department Breakdown ── */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          פילוח לפי מחלקה
        </h2>
        {deptStats.length === 0 ? (
          <EmptyCard message="אין מחלקות להצגה" />
        ) : (
          <div
            className="rounded-xl overflow-x-auto border border-border bg-card"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <table className="w-full text-sm min-w-[600px]">
              <caption className="sr-only">פילוח הסמכות לפי מחלקה</caption>
              <thead>
                <tr className="border-b border-border bg-primary-light">
                  <th scope="col" className="text-right px-4 sm:px-5 py-3 font-medium text-muted">
                    מחלקה
                  </th>
                  <th scope="col" className="text-right px-4 sm:px-5 py-3 font-medium text-muted">
                    עובדים
                  </th>
                  <th scope="col" className="text-right px-4 sm:px-5 py-3 font-medium text-muted">
                    בתוקף
                  </th>
                  <th scope="col" className="text-right px-4 sm:px-5 py-3 font-medium text-muted">
                    פג בקרוב
                  </th>
                  <th scope="col" className="text-right px-4 sm:px-5 py-3 font-medium text-muted">
                    פג תוקף
                  </th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((dept) => (
                  <tr
                    key={dept.name}
                    className="border-b border-border-light last:border-b-0"
                  >
                    <td className="px-4 sm:px-5 py-3.5 font-medium text-foreground">
                      {dept.name}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-muted ltr-nums">
                      {dept.employees}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-success ltr-nums">
                      {dept.valid}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-warning ltr-nums">
                      {dept.expiring}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-danger ltr-nums">
                      {dept.expired}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section D: Employee Status Breakdown ── */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          פילוח לפי סטטוס עובד
        </h2>
        {statusCounts.length === 0 ? (
          <EmptyCard message="אין נתוני סטטוס להצגה" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {statusCounts.map((s) => {
              const colors = statusColorMap[s.label] || statusColorMap["לא פעיל"];
              const pct = totalEmployees > 0 ? Math.round((s.count / totalEmployees) * 100) : 0;
              return (
                <div
                  key={s.label}
                  className={`rounded-xl p-4 border border-border bg-card`}
                  style={{ boxShadow: "var(--shadow-xs)" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                    <span className={`text-sm font-medium ${colors.text}`}>{s.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${colors.text} ltr-nums`}>{s.count}</p>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${colors.barBg}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1 ltr-nums">{pct}%</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section E: Employees Missing Certifications ── */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 flex items-center gap-2">
          <UserX className="h-5 w-5 text-danger" />
          עובדים עם הסמכות חסרות
          {employeesMissing.length > 0 && (
            <span className="text-xs font-normal text-muted">
              ({employeesMissing.length})
            </span>
          )}
        </h2>
        {employeesMissing.length === 0 ? (
          <EmptyCard message="כל העובדים מחזיקים בכל ההסמכות" icon="success" />
        ) : (
          <div className="space-y-3">
            {employeesMissing.slice(0, 20).map((emp) => (
              <div
                key={emp.id}
                className="rounded-xl border border-border bg-card p-4"
                style={{ boxShadow: "var(--shadow-xs)" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{emp.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {emp.department}
                    </p>
                  </div>
                  <span className="text-xs text-muted ltr-nums">
                    {emp.certCount}/{allCertTypes.length} הסמכות
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {emp.missingTypes.map((type) => (
                    <span
                      key={type}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger-light text-danger"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {employeesMissing.length > 20 && (
              <p className="text-sm text-muted text-center">
                ו-{employeesMissing.length - 20} עובדים נוספים...
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Helper Components ──

const colorStyles = {
  blue: { bg: "bg-primary-light", text: "text-primary", iconBg: "bg-primary/10" },
  green: { bg: "bg-success-light", text: "text-success", iconBg: "bg-success/10" },
  yellow: { bg: "bg-warning-light", text: "text-warning", iconBg: "bg-warning/10" },
  red: { bg: "bg-danger-light", text: "text-danger", iconBg: "bg-danger/10" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: keyof typeof colorStyles;
}) {
  const c = colorStyles[color];
  return (
    <div
      className="rounded-xl p-3 sm:p-5 border border-border bg-card"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${c.iconBg} mb-2 sm:mb-3`}>
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${c.text}`} />
      </div>
      <p className={`text-2xl sm:text-3xl font-bold ${c.text} ltr-nums`}>
        {value}
      </p>
      <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 text-muted">{label}</p>
    </div>
  );
}

function TimelineBucket({
  title,
  items,
  color,
}: {
  title: string;
  items: any[];
  color: keyof typeof colorStyles;
}) {
  const c = colorStyles[color];
  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground">{title}</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text} ltr-nums`}
        >
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">אין הסמכות שפג תוקפן</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((item: any) => (
            <li
              key={item.id}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span className="text-foreground">{item.employee_name}</span>
                <span className="text-muted mx-1">·</span>
                <span className="text-muted">{item.cert_type_name}</span>
              </div>
              <span className="text-xs text-muted ltr-nums whitespace-nowrap mr-2">
                {item.expiry_date
                  ? new Date(item.expiry_date).toLocaleDateString("he-IL")
                  : "—"}
              </span>
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-xs text-muted">
              ו-{items.length - 5} נוספים...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function EmptyCard({
  message,
  icon = "info",
}: {
  message: string;
  icon?: "info" | "success";
}) {
  return (
    <div
      className="rounded-xl p-8 text-center border border-border bg-card"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div
        className={`flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-3 ${
          icon === "success" ? "bg-success-light" : "bg-primary-light"
        }`}
      >
        {icon === "success" ? (
          <CheckCircle className="w-6 h-6 text-success" />
        ) : (
          <Building2 className="w-6 h-6 text-primary" />
        )}
      </div>
      <p className="font-medium text-foreground">{message}</p>
    </div>
  );
}
