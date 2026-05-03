"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { SyncSummary } from "@/lib/leads/types";
import { syncLeadsFromSheet } from "@/app/dashboard/candidates/sync-leads-action";

export function SyncLeadsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null
  );

  function buildToast(s: SyncSummary): string {
    return [
      `נוספו ${s.inserted} לידים חדשים`,
      `${s.updated} לידים כבר קיימים (פרטים עודכנו)`,
    ].join(" · ");
  }

  function handleClick() {
    setToast(null);
    startTransition(async () => {
      try {
        const summary = await syncLeadsFromSheet();
        setToast({ kind: "ok", msg: buildToast(summary) });
        router.refresh();
      } catch (e) {
        setToast({
          kind: "err",
          msg: e instanceof Error ? e.message : "שגיאה בסנכרון",
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        סנכרן לידים מהאתר
      </button>
      {toast && (
        <div
          role={toast.kind === "ok" ? "status" : "alert"}
          className={`rounded-lg border px-3 py-2 text-xs ${
            toast.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
