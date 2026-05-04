"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CourseCandidate,
  CandidateStatus,
  PoliceClearanceStatus,
} from "@/types/database";
import {
  CANDIDATE_STATUSES,
  POLICE_CLEARANCE_STATUSES,
} from "@/types/database";
import {
  markLeadRead,
  updateLeadField,
} from "@/app/dashboard/candidates/leads-actions";
import { isValidIsraeliId } from "@/lib/leads/normalize";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface CertTypeOption {
  id: string;
  name: string;
}

interface LeadsTableProps {
  leads: CourseCandidate[];
  certTypes: CertTypeOption[];
}

type LeadField =
  | "city"
  | "notes"
  | "status"
  | "police_clearance_status"
  | "cert_type_id";

function isPhoneValid(p: string | null): boolean {
  if (!p) return false;
  return /^05\d-\d{3}-\d{4}$/.test(p);
}

/**
 * Build an aria-label that disambiguates leads with duplicate first names.
 * The source sheet has multiple rows with the same first_name (e.g. אמיר דואני
 * appears twice). Without a disambiguator, screen-reader users and tests can't
 * tell duplicates apart.
 */
function leadAriaLabel(lead: CourseCandidate): string {
  const suffix = lead.id_number || lead.phone || lead.id;
  return suffix ? `${lead.first_name} — ${suffix}` : lead.first_name;
}

export function LeadsTable({ leads, certTypes }: LeadsTableProps) {
  const router = useRouter();
  const [showRejected, setShowRejected] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Synchronous in-flight set: prop-level `lead.read_at` lags the DB by one
  // router.refresh() round-trip, so a fast tap-tap could fire markLeadRead
  // twice. The ref tracks "currently being marked" IDs so the second call
  // bails immediately.
  const markingRead = useRef<Set<string>>(new Set());

  const visibleLeads = useMemo(() => {
    const interested = leads.filter((l) => l.status !== "לא מעוניין");
    if (!showRejected) return interested;
    const rejected = leads.filter((l) => l.status === "לא מעוניין");
    return [...interested, ...rejected];
  }, [leads, showRejected]);

  function surfaceError(e: unknown) {
    // Re-throw Next.js redirect / not-found sentinels so the framework handles them.
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      typeof (e as { digest: unknown }).digest === "string" &&
      ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (e as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
    ) {
      throw e;
    }
    setError(e instanceof Error ? e.message : "שגיאה בעדכון");
  }

  function handleRowClick(id: string, readAt: string | null) {
    if (readAt) return;
    if (markingRead.current.has(id)) return;
    markingRead.current.add(id);
    setError(null);
    startTransition(async () => {
      try {
        await markLeadRead(id);
        router.refresh();
      } catch (e) {
        surfaceError(e);
      } finally {
        markingRead.current.delete(id);
      }
    });
  }

  function handleField(id: string, field: LeadField, value: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await updateLeadField(id, field, value);
        router.refresh();
      } catch (e) {
        surfaceError(e);
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={showRejected}
          onChange={(e) => setShowRejected(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 cursor-pointer"
        />
        הצג גם לא מעוניין
      </label>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="סגור"
            className="rounded p-0.5 text-red-600 hover:bg-red-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile: card stack — primary fields visible, secondary in expand */}
      <div
        data-testid="leads-mobile"
        className="space-y-2 md:hidden"
      >
        {visibleLeads.map((l) => (
          <LeadCard
            key={l.id}
            lead={l}
            certTypes={certTypes}
            isPending={isPending}
            onRowClick={handleRowClick}
            onField={handleField}
          />
        ))}
      </div>

      {/* Desktop: full table */}
      <div
        data-testid="leads-desktop"
        className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2.5">שם</th>
              <th className="px-3 py-2.5">ת.ז</th>
              <th className="px-3 py-2.5">טלפון</th>
              <th className="px-3 py-2.5">עיר</th>
              <th className="px-3 py-2.5">סטטוס</th>
              <th className="px-3 py-2.5">סוג קורס</th>
              <th className="px-3 py-2.5">אישור משטרה</th>
              <th className="px-3 py-2.5">הערות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleLeads.map((l) => {
              const isUnread = l.read_at === null;
              const idValid = isValidIsraeliId(l.id_number);
              const phoneValid = isPhoneValid(l.phone);
              const isEmptyName = l.first_name === "ללא שם";

              return (
                <tr
                  key={l.id}
                  aria-label={leadAriaLabel(l)}
                  onClick={() => handleRowClick(l.id, l.read_at)}
                  className={`cursor-pointer hover:bg-gray-50/50 transition-colors ${
                    isUnread ? "bg-yellow-50" : ""
                  } ${isPending ? "opacity-70" : ""}`}
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        isEmptyName
                          ? "inline-block rounded border border-red-400 px-1 text-red-700"
                          : "font-medium text-gray-900"
                      }
                      title={isEmptyName ? "שם חסר במקור הסנכרון" : undefined}
                    >
                      {l.first_name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600" dir="ltr">
                    {!idValid && (
                      <AlertTriangle
                        className="ml-1 inline h-3.5 w-3.5 text-yellow-600"
                        aria-label="ת.ז לא תקינה"
                      />
                    )}
                    {l.id_number}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600" dir="ltr">
                    {!phoneValid && l.phone && (
                      <AlertTriangle
                        className="ml-1 inline h-3.5 w-3.5 text-yellow-600"
                        aria-label="טלפון לא תקין"
                      />
                    )}
                    {l.phone || "-"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      defaultValue={l.city ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (l.city ?? "") &&
                        handleField(l.id, "city", e.target.value)
                      }
                      className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1"
                    />
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={l.status}
                      onChange={(e) =>
                        handleField(l.id, "status", e.target.value as CandidateStatus)
                      }
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                    >
                      {CANDIDATE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={l.cert_type_id ?? ""}
                      onChange={(e) =>
                        handleField(l.id, "cert_type_id", e.target.value || null)
                      }
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {certTypes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={l.police_clearance_status}
                      onChange={(e) =>
                        handleField(
                          l.id,
                          "police_clearance_status",
                          e.target.value as PoliceClearanceStatus
                        )
                      }
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                    >
                      {POLICE_CLEARANCE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      defaultValue={l.notes ?? ""}
                      placeholder="—"
                      onBlur={(e) =>
                        e.target.value !== (l.notes ?? "") &&
                        handleField(l.id, "notes", e.target.value || null)
                      }
                      className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface LeadCardProps {
  lead: CourseCandidate;
  certTypes: CertTypeOption[];
  isPending: boolean;
  onRowClick: (id: string, readAt: string | null) => void;
  onField: (id: string, field: LeadField, value: string | null) => void;
}

function LeadCard({
  lead,
  certTypes,
  isPending,
  onRowClick,
  onField,
}: LeadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = lead.read_at === null;
  const idValid = isValidIsraeliId(lead.id_number);
  const phoneValid = isPhoneValid(lead.phone);
  const isEmptyName = lead.first_name === "ללא שם";

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      aria-label={leadAriaLabel(lead)}
      onClick={() => onRowClick(lead.id, lead.read_at)}
      className={`rounded-lg border border-gray-200 p-3 transition-colors ${
        isUnread ? "bg-yellow-50" : "bg-white"
      } ${isPending ? "opacity-70" : ""}`}
    >
      {/* Header: name on the right (RTL) and ת.ז on the left */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className={
            isEmptyName
              ? "inline-block rounded border border-red-400 px-1.5 py-0.5 text-base font-medium text-red-700"
              : "text-base font-semibold text-gray-900"
          }
          title={isEmptyName ? "שם חסר במקור הסנכרון" : undefined}
        >
          {lead.first_name}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-gray-600"
          dir="ltr"
        >
          {!idValid && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-yellow-600"
              aria-label="ת.ז לא תקינה"
            />
          )}
          {lead.id_number || "—"}
        </span>
      </div>

      {/* Phone + city on one line */}
      <div className="mb-3 flex items-center justify-between text-sm text-gray-700">
        <span className="flex items-center gap-1" dir="ltr">
          {!phoneValid && lead.phone && (
            <AlertTriangle
              className="h-3.5 w-3.5 text-yellow-600"
              aria-label="טלפון לא תקין"
            />
          )}
          {lead.phone || "—"}
        </span>
        <span className="text-xs text-gray-500">{lead.city || "—"}</span>
      </div>

      {/* Primary edits: status + cert type, two side-by-side selects */}
      <div className="grid grid-cols-2 gap-2" onClick={stop}>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
            סטטוס
          </span>
          <select
            value={lead.status}
            onChange={(e) =>
              onField(lead.id, "status", e.target.value as CandidateStatus)
            }
            className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
          >
            {CANDIDATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
            סוג קורס
          </span>
          <select
            value={lead.cert_type_id ?? ""}
            onChange={(e) =>
              onField(lead.id, "cert_type_id", e.target.value || null)
            }
            className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
          >
            <option value="">—</option>
            {certTypes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Expand toggle for secondary fields */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-gray-600 hover:text-gray-900"
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            הסתר פרטים
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            עוד פרטים
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2" onClick={stop}>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              עיר
            </span>
            <input
              type="text"
              defaultValue={lead.city ?? ""}
              onBlur={(e) =>
                e.target.value !== (lead.city ?? "") &&
                onField(lead.id, "city", e.target.value)
              }
              className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              אישור משטרה
            </span>
            <select
              value={lead.police_clearance_status}
              onChange={(e) =>
                onField(
                  lead.id,
                  "police_clearance_status",
                  e.target.value as PoliceClearanceStatus
                )
              }
              className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
            >
              {POLICE_CLEARANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              הערות
            </span>
            <input
              type="text"
              defaultValue={lead.notes ?? ""}
              placeholder="—"
              onBlur={(e) =>
                e.target.value !== (lead.notes ?? "") &&
                onField(lead.id, "notes", e.target.value || null)
              }
              className="w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm"
            />
          </label>
        </div>
      )}
    </article>
  );
}
