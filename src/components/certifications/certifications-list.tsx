"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import {
  deleteCertification,
  deleteCertifications,
  getSignedUrl,
} from "@/app/dashboard/certifications/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { formatDateHe, type CertStatus, type CertRow } from "@/types/database";

const statusConfig: Record<
  CertStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  valid: { label: "בתוקף", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  unknown: { label: "לא ידוע", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  expiring_soon: {
    label: "פג בקרוב",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  expired: { label: "פג תוקף", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

function certLabel(c: Pick<CertRow, "employee_name" | "cert_type_name">): string {
  return `${c.employee_name} — ${c.cert_type_name}`;
}

interface CertificationsListProps {
  certs: CertRow[];
  isGuest: boolean;
}

export function CertificationsList({ certs, isGuest }: CertificationsListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    ids: string[];
    names: string[];
  }>({ open: false, ids: [], names: [] });

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 7000);
    return () => clearTimeout(t);
  }, [success]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === certs.length) return new Set();
      return new Set(certs.map((c) => c.id));
    });
  }, [certs]);

  function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = ids.map((id) => {
      const c = certs.find((cc) => cc.id === id);
      return c ? certLabel(c) : id;
    });
    setDeleteDialog({ open: true, ids, names });
  }

  async function handleConfirmDelete() {
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteCertifications(deleteDialog.ids);
      const headline =
        result.deleted === 1
          ? "נמחקה הסמכה אחת"
          : `נמחקו ${result.deleted} הסמכות`;
      if (result.errors.length > 0) {
        setError(`${headline}. שגיאות: ${result.errors.join(", ")}`);
        // Per spec: failing rows remain selected so the user can retry.
        // Errors format is "${id}: message" — recover the failed ids by splitting on the first ":".
        const failedIds = new Set(
          result.errors.map((e) => e.slice(0, e.indexOf(":")).trim())
        );
        setSelected(failedIds);
      } else {
        setSuccess(headline);
        setSelected(new Set());
      }
      setDeleteDialog({ open: false, ids: [], names: [] });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
      // On thrown error (network/auth), nothing was reliably deleted — preserve
      // selection so the user can retry with one click after dismissing the banner.
      setDeleteDialog({ open: false, ids: [], names: [] });
    }
  }

  const showBulkUI = !isGuest;

  async function handleOpenFile(imagePath: string) {
    setError(null);
    try {
      const url = await getSignedUrl(imagePath);
      if (!url) {
        setError("לא ניתן לפתוח את הקובץ. ייתכן שאין לך הרשאה.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("שגיאה בפתיחת הקובץ");
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3 mb-3"
        >
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            aria-label="סגור"
            className="rounded p-0.5 text-green-600 hover:bg-green-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {showBulkUI && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm mb-3">
          <span className="font-medium text-blue-800">{selected.size} נבחרו</span>
          <button
            type="button"
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            מחק נבחרים
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div
        data-testid="certs-desktop"
        className="hidden md:block rounded-xl overflow-x-auto"
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table className="w-full">
          <caption className="sr-only">רשימת הסמכות</caption>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {showBulkUI && (
                <th scope="col" className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    aria-label="בחר הכל"
                    checked={certs.length > 0 && selected.size === certs.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                  />
                </th>
              )}
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>עובד</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>סוג הסמכה</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>קובץ</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>תאריך הנפקה</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>תאריך תפוגה</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>מועד רענון הבא</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>סטטוס</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "#e2e8f0" }}>
            {certs.map((cert) => {
              const sc = statusConfig[cert.status];
              const label = certLabel(cert);
              return (
                <tr key={cert.id} className="transition-colors duration-150">
                  {showBulkUI && (
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`בחר ${label}`}
                        checked={selected.has(cert.id)}
                        onChange={() => toggleSelect(cert.id)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: "#0f172a" }}>{cert.employee_name}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{cert.cert_type_name}</td>
                  <td className="px-6 py-4">
                    {cert.image_url ? (
                      <button
                        type="button"
                        onClick={() => handleOpenFile(cert.image_url!)}
                        title={cert.image_filename || "פתח קובץ"}
                        aria-label={`פתח קובץ ${cert.image_filename || "המצורף"} של ${certLabel(cert)}`}
                        dir="auto"
                        className="inline-flex max-w-[14rem] items-center gap-1.5 truncate text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium hover:bg-emerald-100 hover:underline transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        {cert.image_url.endsWith(".pdf") ? (
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{cert.image_filename || "קובץ"}</span>
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{formatDateHe(cert.issue_date)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{formatDateHe(cert.expiry_date)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{formatDateHe(cert.next_refresh_date)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} aria-hidden="true" />
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
                        action={() => deleteCertification(cert.id)}
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
      <div data-testid="certs-mobile" className="md:hidden space-y-3">
        {certs.map((cert) => {
          const sc = statusConfig[cert.status];
          const label = certLabel(cert);
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {showBulkUI && (
                    <label className="inline-flex h-11 w-11 -m-2 p-2 items-center justify-center cursor-pointer touch-manipulation">
                      <input
                        type="checkbox"
                        aria-label={`בחר ${label}`}
                        checked={selected.has(cert.id)}
                        onChange={() => toggleSelect(cert.id)}
                        className="h-5 w-5 rounded border-gray-300 cursor-pointer accent-primary"
                      />
                    </label>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate" style={{ color: "#0f172a" }}>
                      {cert.employee_name}
                    </h3>
                    <p className="text-sm truncate" style={{ color: "#64748b" }}>
                      {cert.cert_type_name}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} aria-hidden="true" />
                  {sc.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span style={{ color: "#94a3b8" }}>הנפקה: </span>
                  <span style={{ color: "#0f172a" }}>{formatDateHe(cert.issue_date)}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>תפוגה: </span>
                  <span style={{ color: "#0f172a" }}>{formatDateHe(cert.expiry_date)}</span>
                </div>
                {cert.next_refresh_date && (
                  <div>
                    <span style={{ color: "#94a3b8" }}>מועד רענון הבא: </span>
                    <span style={{ color: "#0f172a" }}>{formatDateHe(cert.next_refresh_date)}</span>
                  </div>
                )}
              </div>

              {cert.image_url && (
                <button
                  type="button"
                  onClick={() => handleOpenFile(cert.image_url!)}
                  title={cert.image_filename || "פתח קובץ"}
                  aria-label={`פתח קובץ ${cert.image_filename || "המצורף"} של ${certLabel(cert)}`}
                  dir="auto"
                  className="inline-flex min-h-[44px] max-w-full items-center gap-1.5 text-xs text-emerald-700 hover:underline cursor-pointer touch-manipulation focus:outline-none focus:ring-2 focus:ring-emerald-500/40 rounded"
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{cert.image_filename || "קובץ מצורף"}</span>
                </button>
              )}

              <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                <Link
                  href={`/dashboard/certifications/${cert.id}/edit`}
                  className="inline-flex min-h-[44px] items-center text-sm font-medium transition-colors touch-manipulation"
                  style={{ color: "#2563eb" }}
                >
                  עריכה
                </Link>
                <form action={() => deleteCertification(cert.id)}>
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center text-sm font-medium transition-colors touch-manipulation"
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

      <DeleteDialog
        open={deleteDialog.open}
        itemNames={deleteDialog.names}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
      />
    </>
  );
}
