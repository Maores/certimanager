"use client";

import { useState } from "react";

interface DeleteButtonProps {
  action: () => Promise<void>;
  label?: string;
  confirmLabel?: string;
}

export function DeleteButton({
  action,
  label = "מחיקה",
  confirmLabel = "מחק",
}: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">בטוח?</span>
        <form action={action} className="flex">
          <button
            type="submit"
            className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors"
          >
            {confirmLabel}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ביטול
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
    >
      {label}
    </button>
  );
}
