"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface Props {
  action: (formData: FormData) => Promise<void>;
  defaultValues: {
    name: string;
    default_validity_months: number;
    description: string | null;
  };
}

export function CertTypeEditForm({ action, defaultValues }: Props) {
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
      const msg = e instanceof Error ? e.message : "שגיאה בעדכון סוג הסמכה";
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
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          שם
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={defaultValues.name}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label htmlFor="default_validity_months" className="block text-sm font-medium text-gray-700 mb-1">
          תוקף ברירת מחדל (חודשים)
        </label>
        <input
          type="number"
          id="default_validity_months"
          name="default_validity_months"
          required
          min={1}
          defaultValue={defaultValues.default_validity_months}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          תיאור
        </label>
        <input
          type="text"
          id="description"
          name="description"
          defaultValue={defaultValues.description || ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          עדכן
        </button>
        <Link
          href="/dashboard/cert-types"
          className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium"
        >
          ביטול
        </Link>
      </div>
    </form>
  );
}
