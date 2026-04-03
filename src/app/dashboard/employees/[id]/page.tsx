import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCertStatus, formatDateHe } from "@/types/database";
import type { Employee, Certification } from "@/types/database";
import { DeleteEmployeeButton } from "./delete-button";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (!employee) {
    notFound();
  }

  const { data: certifications } = await supabase
    .from("certifications")
    .select("*, cert_types(name)")
    .eq("employee_id", id)
    .order("expiry_date", { ascending: true });

  const emp = employee as Employee;

  const statusConfig = {
    valid: {
      label: "בתוקף",
      bg: "bg-green-100",
      text: "text-green-800",
      dot: "bg-green-500",
    },
    expiring_soon: {
      label: "פג בקרוב",
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      dot: "bg-yellow-500",
    },
    expired: {
      label: "פג תוקף",
      bg: "bg-red-100",
      text: "text-red-800",
      dot: "bg-red-500",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/employees"
            className="mb-2 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            &rarr; חזרה לרשימת עובדים
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {emp.first_name} {emp.last_name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/employees/${id}/edit`}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            ערוך
          </Link>
          <DeleteEmployeeButton employeeId={id} />
        </div>
      </div>

      {/* Employee info card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          פרטי עובד
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">מספר עובד</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {emp.employee_number}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">מחלקה</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {emp.department || "-"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">טלפון</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <span dir="ltr" className="inline-block">{emp.phone || "-"}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">אימייל</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <span dir="ltr" className="inline-block">{emp.email || "-"}</span>
            </dd>
          </div>
          {emp.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">הערות</dt>
              <dd className="mt-1 text-sm text-gray-900">{emp.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Certifications */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">הסמכות</h2>
          <Link
            href={`/dashboard/employees/${id}/certifications/new`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            + הוסף הסמכה
          </Link>
        </div>

        {!certifications || certifications.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm text-gray-500">
              אין הסמכות רשומות לעובד זה
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(certifications as (Certification & { cert_types: { name: string } })[]).map((cert) => {
              const status = getCertStatus(cert.expiry_date);
              const config = statusConfig[status];

              return (
                <div
                  key={cert.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <h3 className="font-medium text-gray-900">
                      {cert.cert_types?.name ?? cert.cert_type_name ?? "-"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      הונפקה: {formatDateHe(cert.issue_date)} | פג תוקף:{" "}
                      {formatDateHe(cert.expiry_date)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-medium ${config.bg} ${config.text}`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${config.dot}`}
                    />
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
