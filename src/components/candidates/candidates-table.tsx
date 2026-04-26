"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, UserCheck, Users } from "lucide-react";
import type { CourseCandidate, CandidateStatus } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import {
  updateCandidateStatus,
  deleteCandidate,
  deleteCandidates,
  promoteCandidate,
  promoteCandidates,
} from "@/app/dashboard/candidates/actions";
import { PromoteDialog } from "./promote-dialog";
import { DeleteDialog } from "@/components/ui/delete-dialog";

interface CandidatesTableProps {
  candidates: CourseCandidate[];
}

const STATUS_COLORS: Record<CandidateStatus, string> = {
  "ממתין": "bg-yellow-100 text-yellow-800",
  "נרשם": "bg-blue-100 text-blue-800",
  "השלים": "bg-green-100 text-green-800",
  "הוסמך": "bg-purple-100 text-purple-800",
};

export function CandidatesTable({ candidates }: CandidatesTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 7000);
    return () => clearTimeout(t);
  }, [success]);
  const [promoteDialog, setPromoteDialog] = useState<{
    open: boolean;
    ids: string[];
    names: string[];
  }>({ open: false, ids: [], names: [] });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    ids: string[];
    names: string[];
  }>({ open: false, ids: [], names: [] });

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
      if (prev.size === candidates.length) return new Set();
      return new Set(candidates.map((c) => c.id));
    });
  }, [candidates]);

  async function handleStatusChange(id: string, newStatus: CandidateStatus) {
    setError(null);
    if (newStatus === "הוסמך") {
      const candidate = candidates.find((c) => c.id === id);
      if (candidate) {
        setPromoteDialog({
          open: true,
          ids: [id],
          names: [`${candidate.first_name} ${candidate.last_name}`],
        });
      }
      return;
    }
    try {
      await updateCandidateStatus(id, newStatus);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בעדכון סטטוס");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("האם למחוק מועמד זה?")) return;
    setError(null);
    try {
      await deleteCandidate(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
    }
  }

  function handlePromoteSingle(id: string) {
    const candidate = candidates.find((c) => c.id === id);
    if (candidate) {
      setPromoteDialog({
        open: true,
        ids: [id],
        names: [`${candidate.first_name} ${candidate.last_name}`],
      });
    }
  }

  function handleBulkPromote() {
    const ids = Array.from(selected);
    const names = ids.map((id) => {
      const c = candidates.find((cc) => cc.id === id);
      return c ? `${c.first_name} ${c.last_name}` : id;
    });
    setPromoteDialog({ open: true, ids, names });
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = ids.map((id) => {
      const c = candidates.find((cc) => cc.id === id);
      return c ? `${c.first_name} ${c.last_name}` : id;
    });
    setDeleteDialog({ open: true, ids, names });
  }

  async function handleConfirmDelete() {
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteCandidates(deleteDialog.ids);
      const headline =
        result.deleted === 1
          ? "נמחק מועמד אחד"
          : `נמחקו ${result.deleted} מועמדים`;
      if (result.errors.length > 0) {
        setError(`${headline}. שגיאות: ${result.errors.join(", ")}`);
      } else {
        setSuccess(headline);
      }
      setDeleteDialog({ open: false, ids: [], names: [] });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
      setDeleteDialog({ open: false, ids: [], names: [] });
    }
  }

  async function handleConfirmPromote() {
    setError(null);
    setSuccess(null);
    try {
      if (promoteDialog.ids.length === 1) {
        const r = await promoteCandidate(promoteDialog.ids[0]);
        setSuccess(
          r.status === "already_employee"
            ? `${r.name} כבר קיים ברשימת העובדים`
            : `${r.name} נוסף בהצלחה לרשימת העובדים`
        );
      } else {
        const result = await promoteCandidates(promoteDialog.ids);
        const parts: string[] = [];
        if (result.promoted > 0) parts.push(`קודמו ${result.promoted} מועמדים`);
        if (result.already_employee > 0) parts.push(`${result.already_employee} כבר היו עובדים`);
        if (result.errors.length > 0) {
          setError(`${parts.join(", ") || "ללא הצלחות"}. שגיאות: ${result.errors.join(", ")}`);
        } else {
          setSuccess(parts.join(", ") || "לא בוצעו שינויים");
        }
      }
      setPromoteDialog({ open: false, ids: [], names: [] });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בקידום");
      setPromoteDialog({ open: false, ids: [], names: [] });
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3">
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-blue-800">{selected.size} נבחרו</span>
          <button
            type="button"
            onClick={handleBulkPromote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            קדם לעובדים
          </button>
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

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2.5 w-10">
                <input
                  type="checkbox"
                  checked={selected.size === candidates.length && candidates.length > 0}
                  onChange={toggleAll}
                  aria-label="בחר הכל"
                  className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5">שם</th>
              <th className="px-3 py-2.5">ת.ז</th>
              <th className="hidden px-3 py-2.5 md:table-cell">טלפון</th>
              <th className="hidden px-3 py-2.5 md:table-cell">עיר</th>
              <th className="px-3 py-2.5">הסמכה</th>
              <th className="px-3 py-2.5">סטטוס</th>
              <th className="hidden px-3 py-2.5 md:table-cell">עובד</th>
              <th className="px-3 py-2.5 w-24">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    aria-label={`בחר ${c.first_name} ${c.last_name}`}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-900">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-600" dir="ltr">
                  {c.id_number}
                </td>
                <td className="hidden px-3 py-2.5 text-right text-gray-600 md:table-cell" dir="ltr">
                  {c.phone || "-"}
                </td>
                <td className="hidden px-3 py-2.5 text-gray-600 md:table-cell">
                  {c.city || "-"}
                </td>
                <td className="px-3 py-2.5 text-gray-600">
                  {c.cert_type_name || "-"}
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={c.status}
                    onChange={(e) => handleStatusChange(c.id, e.target.value as CandidateStatus)}
                    aria-label={`סטטוס ${c.first_name} ${c.last_name}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${STATUS_COLORS[c.status]}`}
                  >
                    {CANDIDATE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  {c.is_employee ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      כן
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      לא
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {c.is_employee ? (
                      <span
                        title="כבר עובד"
                        aria-label={`${c.first_name} ${c.last_name} כבר עובד`}
                        className="rounded-lg p-1.5 text-green-600"
                      >
                        <UserCheck className="h-4 w-4" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePromoteSingle(c.id)}
                        title="הוסף כעובד"
                        aria-label={`קדם ${c.first_name} ${c.last_name} לעובד`}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors cursor-pointer"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      title="מחק"
                      aria-label={`מחק ${c.first_name} ${c.last_name}`}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PromoteDialog
        open={promoteDialog.open}
        candidateNames={promoteDialog.names}
        onConfirm={handleConfirmPromote}
        onCancel={() => setPromoteDialog({ open: false, ids: [], names: [] })}
      />

      <DeleteDialog
        open={deleteDialog.open}
        itemNames={deleteDialog.names}
        noun="מועמד"
        nounPlural="מועמדים"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
      />
    </div>
  );
}
