"use client";

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  candidateNames: string[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteDialog({ open, candidateNames, onConfirm, onCancel }: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  const isBulk = candidateNames.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isBulk ? `מחיקת ${candidateNames.length} מועמדים` : "מחיקת מועמד"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-600">
          {isBulk
            ? `האם למחוק ${candidateNames.length} מועמדים? פעולה זו אינה ניתנת לביטול.`
            : `האם למחוק את ${candidateNames[0]}? פעולה זו אינה ניתנת לביטול.`}
        </p>

        {isBulk && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            <ul className="space-y-1 text-sm text-gray-700">
              {candidateNames.map((name, idx) => (
                <li key={idx}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-danger/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                מוחק...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                מחק
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-muted hover:bg-gray-50 hover:text-foreground transition-colors cursor-pointer"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
