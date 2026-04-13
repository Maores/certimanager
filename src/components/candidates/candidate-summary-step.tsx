"use client";

import Link from "next/link";
import type { CandidateImportResult } from "@/app/dashboard/candidates/actions";

interface CandidateSummaryStepProps {
  result: CandidateImportResult;
  onReset: () => void;
}

export function CandidateSummaryStep({ result, onReset }: CandidateSummaryStepProps) {
  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center">
        <span className="text-5xl">✅</span>
        <h2 className="mt-3 text-xl font-bold text-gray-900">
          הייבוא הושלם בהצלחה
        </h2>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{result.imported}</p>
          <p className="mt-1 text-xs text-gray-500">מועמדים יובאו</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
          <p className="mt-1 text-xs text-gray-500">דולגו</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
          <p className="mt-1 text-xs text-gray-500">שגיאות</p>
        </div>
      </div>

      {/* Errors section */}
      {result.errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">
            שגיאות ({result.errors.length}):
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-red-700">
            {result.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation links */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/dashboard/candidates"
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          צפה במועמדים
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          ייבוא נוסף
        </button>
      </div>
    </div>
  );
}
