"use client";

import { useMemo, useState, useTransition } from "react";
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
import { AlertTriangle } from "lucide-react";

interface CertTypeOption {
  id: string;
  name: string;
}

interface LeadsTableProps {
  leads: CourseCandidate[];
  certTypes: CertTypeOption[];
}

function isPhoneValid(p: string | null): boolean {
  if (!p) return false;
  return /^05\d-\d{3}-\d{4}$/.test(p);
}

export function LeadsTable({ leads, certTypes }: LeadsTableProps) {
  const router = useRouter();
  const [showRejected, setShowRejected] = useState(false);
  const [isPending, startTransition] = useTransition();

  const visibleLeads = useMemo(() => {
    const interested = leads.filter((l) => l.status !== "לא מעוניין");
    if (!showRejected) return interested;
    const rejected = leads.filter((l) => l.status === "לא מעוניין");
    return [...interested, ...rejected];
  }, [leads, showRejected]);

  function handleRowClick(id: string, readAt: string | null) {
    if (readAt) return;
    startTransition(async () => {
      await markLeadRead(id);
      router.refresh();
    });
  }

  function handleField(
    id: string,
    field:
      | "city"
      | "notes"
      | "status"
      | "police_clearance_status"
      | "cert_type_id",
    value: string | null
  ) {
    startTransition(async () => {
      await updateLeadField(id, field, value);
      router.refresh();
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

      <div className="overflow-x-auto rounded-lg border border-gray-200">
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
                  aria-label={l.first_name}
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
