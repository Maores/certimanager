"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, Loader2 } from "lucide-react";

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] text-xs font-medium text-white bg-danger hover:bg-red-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </button>
  );
}

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
        <span className="text-xs text-muted">בטוח?</span>
        <form action={action} className="flex">
          <ConfirmButton label={confirmLabel} />
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-[44px] text-xs font-medium text-muted hover:text-foreground px-3 py-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
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
      className="inline-flex items-center gap-1 text-sm font-medium text-danger hover:text-red-800 transition-colors cursor-pointer"
    >
      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}
