"use client";

import { useTransition, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  CircleDot,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { createTask, updateTaskStatus, deleteTask, deleteTasks } from "./actions";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { DeleteDialog } from "@/components/ui/delete-dialog";

interface Task {
  id: string;
  employee_id: string;
  description: string;
  responsible: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  employee_name: string;
}

interface Employee {
  id: string;
  name: string;
}

interface TasksClientProps {
  tasks: Task[];
  employees: Employee[];
  responsibleList: string[];
  counts: { "פתוח": number; "בטיפול": number; "הושלם": number };
  statusFilter: string;
  responsibleFilter: string;
}

const statusConfig: Record<
  string,
  { color: string; bg: string; icon: typeof CircleDot }
> = {
  "פתוח": {
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: CircleDot,
  },
  "בטיפול": {
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
    icon: Clock,
  },
  "הושלם": {
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle2,
  },
};

function formatDate(dateString: string): string {
  if (!dateString) return "—";
  const parts = dateString.split("T")[0].split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("he-IL");
  }
  return new Date(dateString).toLocaleDateString("he-IL");
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig["פתוח"];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

function taskLabel(t: Pick<Task, "employee_name" | "description">): string {
  const desc = t.description.length > 40 ? `${t.description.slice(0, 40)}…` : t.description;
  return `${t.employee_name} — ${desc}`;
}

export function TasksClient({
  tasks,
  employees,
  responsibleList,
  counts,
  statusFilter,
  responsibleFilter,
}: TasksClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
      if (prev.size === tasks.length) return new Set();
      return new Set(tasks.map((t) => t.id));
    });
  }, [tasks]);

  function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = ids.map((id) => {
      const t = tasks.find((tt) => tt.id === id);
      return t ? taskLabel(t) : id;
    });
    setDeleteDialog({ open: true, ids, names });
  }

  async function handleConfirmDelete() {
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteTasks(deleteDialog.ids);
      const headline =
        result.deleted === 1
          ? "נמחקה משימה אחת"
          : `נמחקו ${result.deleted} משימות`;
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

  function handleStatusChange(taskId: string, newStatus: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, newStatus);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בעדכון");
      }
    });
  }

  function handleDelete(taskId: string) {
    if (!confirm("האם למחוק את המשימה?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteTask(taskId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה במחיקה");
      }
    });
  }

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createTask(formData);
        setShowForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה ביצירה");
      }
    });
  }

  const total = counts["פתוח"] + counts["בטיפול"] + counts["הושלם"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">משימות</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover cursor-pointer"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              ביטול
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              משימה חדשה
            </>
          )}
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground mt-1">סה&quot;כ</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{counts["פתוח"]}</p>
          <p className="text-xs text-blue-600 mt-1">פתוח</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">
            {counts["בטיפול"]}
          </p>
          <p className="text-xs text-yellow-600 mt-1">בטיפול</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {counts["הושלם"]}
          </p>
          <p className="text-xs text-green-600 mt-1">הושלם</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3"
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

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
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

      {/* New task form */}
      {showForm && (
        <form
          action={handleCreate}
          className="rounded-lg border border-border bg-white p-4 space-y-4"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <h2 className="text-lg font-semibold text-foreground">
            משימה חדשה
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="task-employee" className="block text-sm font-medium text-foreground mb-1">
                עובד *
              </label>
              <select
                id="task-employee"
                name="employee_id"
                required
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer"
              >
                <option value="">בחר עובד</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-responsible" className="block text-sm font-medium text-foreground mb-1">
                אחראי
              </label>
              <input
                type="text"
                id="task-responsible"
                name="responsible"
                maxLength={50}
                placeholder="שם האחראי על המשימה"
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring"
              />
            </div>
          </div>
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-foreground mb-1">
              תיאור המשימה *
            </label>
            <textarea
              id="task-description"
              name="description"
              required
              rows={3}
              maxLength={500}
              placeholder="תאר את המשימה..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "שומר..." : "צור משימה"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <form method="GET" className="flex flex-col sm:flex-row gap-3">
        <AutoSubmitSelect
          name="status"
          defaultValue={statusFilter}
          aria-label="סינון לפי סטטוס"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-48"
        >
          <option value="">כל הסטטוסים</option>
          <option value="פתוח">פתוח</option>
          <option value="בטיפול">בטיפול</option>
          <option value="הושלם">הושלם</option>
        </AutoSubmitSelect>
        <AutoSubmitSelect
          name="responsible"
          defaultValue={responsibleFilter}
          aria-label="סינון לפי אחראי"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-48"
        >
          <option value="">כל האחראים</option>
          {responsibleList.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </AutoSubmitSelect>
      </form>

      {/* Tasks table */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <ClipboardList className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted">לא נמצאו משימות</p>
          <p className="mt-1 text-sm text-muted-foreground">
            צור משימה חדשה כדי להתחיל
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div
            data-testid="tasks-desktop"
            className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-white"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <table className="w-full text-sm">
              <caption className="sr-only">רשימת משימות</caption>
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th scope="col" className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="בחר הכל"
                      checked={tasks.length > 0 && selected.size === tasks.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                    עובד
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                    תיאור
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                    אחראי
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                    סטטוס
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                    תאריך
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-border last:border-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`בחר ${taskLabel(task)}`}
                        checked={selected.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {task.employee_name}
                    </td>
                    <td className="px-4 py-3 text-foreground max-w-xs">
                      <span className="line-clamp-2">{task.description}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {task.responsible || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.status}
                        onChange={(e) =>
                          handleStatusChange(task.id, e.target.value)
                        }
                        disabled={isPending}
                        className="rounded-lg border border-border bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer disabled:opacity-50"
                      >
                        <option value="פתוח">פתוח</option>
                        <option value="בטיפול">בטיפול</option>
                        <option value="הושלם">הושלם</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formatDate(task.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(task.id)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="מחק משימה"
                        aria-label="מחק משימה"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div data-testid="tasks-mobile" className="sm:hidden space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-white p-4 space-y-3"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <label className="inline-flex h-11 w-11 -m-2 p-2 items-center justify-center cursor-pointer touch-manipulation">
                      <input
                        type="checkbox"
                        aria-label={`בחר ${taskLabel(task)}`}
                        checked={selected.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="h-5 w-5 rounded border-gray-300 cursor-pointer accent-primary"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">
                        {task.employee_name}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.description}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={isPending}
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                    aria-label="מחק משימה"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge status={task.status} />
                  {task.responsible && (
                    <span className="text-muted-foreground">
                      אחראי: {task.responsible}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {formatDate(task.created_at)}
                  </span>
                </div>
                <select
                  value={task.status}
                  onChange={(e) =>
                    handleStatusChange(task.id, e.target.value)
                  }
                  disabled={isPending}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer disabled:opacity-50"
                >
                  <option value="פתוח">פתוח</option>
                  <option value="בטיפול">בטיפול</option>
                  <option value="הושלם">הושלם</option>
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      <DeleteDialog
        open={deleteDialog.open}
        itemNames={deleteDialog.names}
        noun="משימה"
        nounPlural="משימות"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
      />
    </div>
  );
}
