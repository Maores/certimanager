import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCertStatus, formatDateHe } from "@/types/database";
import type { Employee, Certification } from "@/types/database";
import { DeleteEmployeeButton } from "./delete-button";
import { getSignedUrl } from "@/app/dashboard/certifications/actions";
import { CertFileViewer } from "./cert-file-viewer";
import { ArrowRight, Pencil, Plus } from "lucide-react";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployee, guestGetCertsByEmployee } from "@/lib/guest-store";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestSid = await getGuestSessionId();

  let employee: Employee | null;
  let certifications: any[] | null;

  if (guestSid) {
    employee = guestGetEmployee(guestSid, id);
    if (!employee) { notFound(); }
    certifications = guestGetCertsByEmployee(guestSid, id);
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: empData } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("manager_id", user!.id)
      .single();

    employee = empData as Employee | null;
    if (!employee) { notFound(); }

    const { data: certData } = await supabase
      .from("certifications")
      .select("*, cert_types(name)")
      .eq("employee_id", id)
      .order("expiry_date", { ascending: true });

    certifications = certData;
  }

  const emp = employee as Employee;

  // Generate signed URLs for certs with files (skip for guest mode)
  const certsWithUrls = guestSid
    ? ((certifications || []) as any[]).map((cert) => ({ ...cert, signedUrl: null }))
    : await Promise.all(
        ((certifications || []) as (Certification & { cert_types: { name: string } })[]).map(
          async (cert) => {
            let signedUrl: string | null = null;
            if (cert.image_url) {
              signedUrl = await getSignedUrl(cert.image_url);
            }
            return { ...cert, signedUrl };
          }
        )
      );

  const statusConfig = {
    valid: {
      label: "בתוקף",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    expiring_soon: {
      label: "פג בקרוב",
      bg: "bg-amber-50",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    expired: {
      label: "פג תוקף",
      bg: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-500",
    },
    unknown: {
      label: "לא ידוע",
      bg: "bg-gray-100",
      text: "text-gray-500",
      dot: "bg-gray-400",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/employees"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b] hover:text-[#2563eb] transition-colors"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            חזרה לרשימת עובדים
          </Link>
          <h1 className="text-2xl font-bold text-[#0f172a]">
            {emp.first_name} {emp.last_name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/employees/${id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#eff6ff] hover:border-[#2563eb] transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <Pencil className="h-4 w-4" />
            ערוך
          </Link>
          <DeleteEmployeeButton employeeId={id} />
        </div>
      </div>

      {/* Employee info card */}
      <div
        className="rounded-xl border border-[#e2e8f0] bg-white p-6"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <h2 className="mb-5 text-lg font-semibold text-[#0f172a]">
          פרטי עובד
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-[#f8fafc] p-3">
            <dt className="text-xs font-medium text-[#64748b] uppercase tracking-wide">מספר זהות/דרכון</dt>
            <dd className="mt-1 text-sm font-medium text-[#0f172a]">
              {emp.employee_number}
            </dd>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-3">
            <dt className="text-xs font-medium text-[#64748b] uppercase tracking-wide">מחלקה</dt>
            <dd className="mt-1 text-sm font-medium text-[#0f172a]">
              {emp.department || "-"}
            </dd>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-3">
            <dt className="text-xs font-medium text-[#64748b] uppercase tracking-wide">טלפון</dt>
            <dd className="mt-1 text-sm font-medium text-[#0f172a]">
              <span dir="ltr" className="inline-block">{emp.phone || "-"}</span>
            </dd>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-3">
            <dt className="text-xs font-medium text-[#64748b] uppercase tracking-wide">אימייל</dt>
            <dd className="mt-1 text-sm font-medium text-[#0f172a]">
              <span dir="ltr" className="inline-block">{emp.email || "-"}</span>
            </dd>
          </div>
          {emp.notes && (
            <div className="sm:col-span-2 rounded-lg bg-[#f8fafc] p-3">
              <dt className="text-xs font-medium text-[#64748b] uppercase tracking-wide">הערות</dt>
              <dd className="mt-1 text-sm text-[#0f172a]">{emp.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Certifications */}
      <div
        className="rounded-xl border border-[#e2e8f0] bg-white p-6"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0f172a]">הסמכות</h2>
          <Link
            href={`/dashboard/employees/${id}/certifications/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <Plus className="h-4 w-4" />
            הוסף הסמכה
          </Link>
        </div>

        {!certifications || certifications.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#e2e8f0] p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff]">
              <Plus className="h-6 w-6 text-[#2563eb]" />
            </div>
            <p className="text-sm font-medium text-[#0f172a]">
              אין הסמכות רשומות
            </p>
            <p className="mt-1 text-xs text-[#94a3b8]">
              הוסף הסמכה ראשונה לעובד זה כדי להתחיל לעקוב
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {certsWithUrls.map((cert) => {
              const status = getCertStatus(cert.expiry_date);
              const config = statusConfig[status];
              const isPdf = cert.image_url?.endsWith(".pdf");

              return (
                <div
                  key={cert.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#e2e8f0] bg-white p-4 transition-colors hover:border-[#2563eb]/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    {cert.signedUrl && (
                      <CertFileViewer
                        src={cert.signedUrl}
                        isPdf={!!isPdf}
                      />
                    )}
                    <div className="space-y-1">
                      <h3 className="font-medium text-[#0f172a]">
                        {cert.cert_types?.name ?? cert.cert_type_name ?? "-"}
                      </h3>
                      <p className="text-sm text-[#94a3b8]">
                        הונפקה: {formatDateHe(cert.issue_date)} | פג תוקף:{" "}
                        {formatDateHe(cert.expiry_date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold ${config.bg} ${config.text}`}
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
