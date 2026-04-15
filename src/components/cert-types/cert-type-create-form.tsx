"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

interface Props {
  action: (formData: FormData) => Promise<void>;
}

export function CertTypeCreateForm({ action }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await action(formData);
    } catch (e) {
      // Re-throw Next.js redirect signals so navigation proceeds
      if (e instanceof Error && "digest" in e && typeof e.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : "שגיאה ביצירת סוג הסמכה";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {/* Name field */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="ct-name" className="mb-1.5 block text-sm font-medium text-foreground">
            שם <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="ct-name"
            name="name"
            required
            maxLength={100}
            placeholder="לדוגמה: עבודה בגובה"
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="ct-validity" className="mb-1.5 block text-sm font-medium text-foreground">
            תוקף ברירת מחדל (חודשים) <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            id="ct-validity"
            name="default_validity_months"
            required
            min={1}
            defaultValue={12}
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label htmlFor="ct-desc" className="mb-1.5 block text-sm font-medium text-foreground">
            תיאור
          </label>
          <input
            type="text"
            id="ct-desc"
            name="description"
            maxLength={200}
            placeholder="תיאור קצר (אופציונלי)"
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div className="flex justify-start">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          הוסף סוג
        </button>
      </div>
    </form>
  );
}
