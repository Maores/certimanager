"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, CheckSquare, Square, MinusSquare } from "lucide-react";
import type { Employee } from "@/types/database";
import { deleteEmployees } from "@/app/dashboard/employees/actions";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

interface EmployeeListClientProps {
  employees: Employee[];
}

export function EmployeeListClient({ employees }: EmployeeListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const allSelected = employees.length > 0 && selectedIds.size === employees.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < employees.length;

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map((e) => e.id)));
    }
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteEmployees(Array.from(selectedIds));
        setSelectedIds(new Set());
        setShowDialog(false);
        router.refresh();
      } catch {
        setShowDialog(false);
        alert("שגיאה במחיקת עובדים. נסה שוב.");
      }
    });
  }

  return (
    <>
      {/* Desktop table */}
      <div
        className="hidden overflow-hidden rounded-lg border bg-white sm:block"
        style={{
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table className="min-w-full" style={{ borderColor: "var(--border)" }}>
          <thead style={{ backgroundColor: "var(--primary-light)" }}>
            <tr>
              <th className="w-12 px-4 py-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center justify-center cursor-pointer"
                  title={allSelected ? "בטל בחירת הכל" : "בחר הכל"}
                >
                  {allSelected ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : someSelected ? (
                    <MinusSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-right text-sm font-medium text-muted">שם</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-muted">מספר עובד</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-muted">מחלקה</th>
              <th className="px-6 py-3 text-right text-sm font-medium text-muted">טלפון</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {employees.map((employee) => {
              const isSelected = selectedIds.has(employee.id);
              return (
                <tr
                  key={employee.id}
                  className="transition-colors"
                  style={{
                    backgroundColor: isSelected ? "var(--primary-light)" : "#fff",
                  }}
                >
                  <td className="w-12 px-4 py-4">
                    <button
                      type="button"
                      onClick={() => toggleOne(employee.id)}
                      className="flex items-center justify-center cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/employees/${employee.id}`}
                      className="font-medium text-primary transition-colors hover:text-primary-hover"
                    >
                      {employee.first_name} {employee.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">
                    {employee.employee_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">
                    {employee.department}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted" dir="ltr">
                    {employee.phone}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 sm:hidden">
        {employees.map((employee) => {
          const isSelected = selectedIds.has(employee.id);
          return (
            <div
              key={employee.id}
              className="relative rounded-lg border bg-white p-4 transition-all duration-150"
              style={{
                borderColor: isSelected ? "var(--primary)" : "var(--border)",
                backgroundColor: isSelected ? "var(--primary-light)" : "#fff",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleOne(employee.id)}
                className="absolute top-3 left-3 cursor-pointer"
              >
                {isSelected ? (
                  <CheckSquare className="h-5 w-5 text-primary" />
                ) : (
                  <Square className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              <Link href={`/dashboard/employees/${employee.id}`}>
                <div className="flex items-center justify-between pr-0 pl-8">
                  <h3 className="font-medium text-foreground">
                    {employee.first_name} {employee.last_name}
                  </h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--primary-light)",
                      color: "var(--primary)",
                    }}
                  >
                    {employee.employee_number}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted pl-8">
                  {employee.department && <p>מחלקה: {employee.department}</p>}
                  {employee.phone && (
                    <p dir="ltr" className="text-right">
                      {employee.phone}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-[60] flex justify-center px-4 animate-fade-in">
          <div
            className="flex items-center gap-4 rounded-xl bg-white px-5 py-3 border"
            style={{
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} עובדים נבחרו
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
            >
              {allSelected ? "בטל בחירה" : "בחר הכל"}
            </button>
            <button
              type="button"
              onClick={() => setShowDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer"
              style={{ backgroundColor: "var(--danger)" }}
            >
              <Trash2 className="h-4 w-4" />
              מחק נבחרים
            </button>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <ConfirmDeleteDialog
        count={selectedIds.size}
        open={showDialog}
        loading={isPending}
        onConfirm={handleDelete}
        onCancel={() => !isPending && setShowDialog(false)}
      />
    </>
  );
}
