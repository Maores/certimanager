"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";

interface ConfirmDeleteDialogProps {
  count: number;
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteDialog({
  count,
  open,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md rounded-xl bg-white p-6 animate-fade-in"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute top-3 left-3 rounded-lg p-1 text-muted hover:text-foreground hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--danger-light)" }}
          >
            <AlertTriangle className="h-7 w-7" style={{ color: "var(--danger)" }} />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-bold text-center text-foreground mb-2">
          מחיקת {count} עובדים
        </h3>
        <p className="text-sm text-center text-muted leading-relaxed">
          האם למחוק {count} עובדים? פעולה זו תמחק גם את כל ההסמכות שלהם.
          <br />
          <span className="font-medium text-danger">לא ניתן לבטל פעולה זו.</span>
        </p>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-70"
            style={{ backgroundColor: "var(--danger)" }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                מוחק...
              </>
            ) : (
              "מחק"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
