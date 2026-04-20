"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markFeedbackRead } from "./actions";

export function MarkReadButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markFeedbackRead(id);
          router.refresh();
        })
      }
      className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-gray-50 transition-colors disabled:opacity-60 touch-manipulation"
    >
      סמן כנקרא
    </button>
  );
}
