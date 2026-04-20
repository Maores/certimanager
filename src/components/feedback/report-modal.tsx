"use client";

import { useState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { MessageSquareWarning, Loader2 } from "lucide-react";

type Category = "bug" | "suggestion" | "question" | "other";

const CATEGORY_LABELS: Record<Category, string> = {
  bug: "באג",
  suggestion: "הצעה",
  question: "שאלה",
  other: "אחר",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60 touch-manipulation"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? "שולח…" : "שלח דיווח"}
    </button>
  );
}

export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click-outside and Escape close
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(false), 5000);
    return () => clearTimeout(t);
  }, [success]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("route", window.location.pathname + window.location.search);
    formData.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    formData.set("user_agent", navigator.userAgent);

    const { submitFeedback } = await import("@/app/dashboard/feedback/actions");
    const result = await submitFeedback(formData);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDescription("");
    setCategory("bug");
    setOpen(false);
    setSuccess(true);
  }

  const charCount = description.length;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="דווח על בעיה"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted hover:text-amber-600 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer touch-manipulation"
      >
        <MessageSquareWarning className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">דווח</span>
      </button>

      <div
        ref={popoverRef}
        role="dialog"
        aria-label="דווח על בעיה"
        aria-hidden={!open}
        className={`absolute top-full left-0 mt-2 w-96 max-w-[calc(100vw-5rem)] rounded-2xl bg-white border border-border z-[60] origin-top-left transition-all duration-150 ease-out ${
          open
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 -translate-y-1 scale-95 pointer-events-none"
        }`}
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <form
          action={handleSubmit}
          className="rounded-2xl"
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-base font-semibold text-foreground">
              דווח על בעיה
            </h2>
          </div>

          <div className="px-5 py-4 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="fb-category" className="block text-sm font-medium text-foreground mb-1.5">
                קטגוריה
              </label>
              <select
                id="fb-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer"
              >
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fb-description" className="block text-sm font-medium text-foreground mb-1.5">
                תיאור
              </label>
              <textarea
                id="fb-description"
                name="description"
                required
                minLength={1}
                maxLength={2000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="מה קרה? מה ציפית שיקרה? איפה בדיוק?"
                className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring resize-y"
              />
              <p className="mt-1 text-xs text-muted-foreground text-left" dir="ltr">
                {charCount} / 2000
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              נשמר אוטומטית: הדף הנוכחי, גודל מסך, דפדפן.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors touch-manipulation"
            >
              ביטול
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>

      {success && (
        <div
          role="status"
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg animate-fade-in"
        >
          תודה! הדיווח נשלח
        </div>
      )}
    </div>
  );
}
