"use client";

import Link from "next/link";
import type { ImportResponse } from "@/app/dashboard/import/actions";

interface SummaryStepProps {
  summary: ImportResponse["summary"];
  onReset: () => void;
}

export function SummaryStep({ summary, onReset }: SummaryStepProps) {
  if (!summary) return null;

  const stats = [
    { label: "עובדים נוצרו", value: summary.employeesCreated, color: "text-green-700" },
    { label: "עובדים דולגו", value: summary.employeesSkipped, color: "text-gray-600" },
    { label: "סוגי הסמכה נוצרו", value: summary.certTypesCreated, color: "text-blue-700" },
    { label: "הסמכות נוצרו", value: summary.certificationsCreated, color: "text-green-700" },
    { label: "הסמכות דולגו", value: summary.certificationsSkipped, color: "text-gray-600" },
  ];

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-gray-200 bg-white p-3 text-center"
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Errors section */}
      {summary.errors.length > 0 && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">
            שגיאות ({summary.errors.length}):
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-red-700">
            {summary.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation links */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          צפה בעובדים
        </Link>
        <Link
          href="/dashboard/certifications"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          צפה בהסמכות
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
