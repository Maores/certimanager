"use client";

import { useState } from "react";
import { deleteEmployee } from "../actions";

export function DeleteEmployeeButton({ employeeId }: { employeeId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">למחוק?</span>
        <form
          action={async () => {
            await deleteEmployee(employeeId);
          }}
          className="flex"
        >
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            כן, מחק
          </button>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
      className="inline-flex min-h-[44px] items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 transition-colors touch-manipulation"
    >
      מחק
    </button>
  );
}
