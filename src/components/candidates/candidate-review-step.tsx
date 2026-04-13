"use client";

import type { CandidateImportPreview } from "@/app/dashboard/candidates/actions";

interface CandidateReviewStepProps {
  data: CandidateImportPreview;
  onConfirm: () => void;
  onBack: () => void;
  importing: boolean;
}

export function CandidateReviewStep({ data, onConfirm, onBack, importing }: CandidateReviewStepProps) {
  const newCandidates = data.candidates.filter((c) => !c.existsInDb);
  const existingCandidates = data.candidates.filter((c) => c.existsInDb);
  const previewRows = data.candidates.slice(0, 50);

  const stats = [
    { label: "שורות שנקראו", value: data.totalRows, color: "text-gray-900" },
    { label: "מועמדים חדשים", value: newCandidates.length, color: "text-green-700" },
    { label: "קיימים (יעודכנו)", value: existingCandidates.length, color: "text-blue-700" },
    { label: "שורות שדולגו", value: data.skipped.length, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Preview table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">שם</th>
              <th className="px-3 py-2">ת.ז</th>
              <th className="px-3 py-2">הסמכה</th>
              <th className="px-3 py-2">מצב</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {previewRows.map((c, idx) => (
              <tr
                key={`${c.id_number}-${idx}`}
                className={c.existsInDb ? "bg-gray-50" : "bg-green-50/30"}
              >
                <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-3 py-2 text-gray-600" dir="ltr">
                  {c.id_number}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {c.cert_type_name || "-"}
                </td>
                <td className="px-3 py-2">
                  {c.existsInDb ? (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      קיים
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      חדש
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.candidates.length > 50 && (
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
            מוצגות 50 שורות ראשונות מתוך {data.candidates.length}
          </div>
        )}
      </div>

      {/* Skipped rows */}
      {data.skipped.length > 0 && (
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            שורות שדולגו ({data.skipped.length})
          </summary>
          <div className="border-t border-gray-200 p-4">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-right text-gray-500">
                  <tr>
                    <th className="px-2 py-1">שורה</th>
                    <th className="px-2 py-1">סיבה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.skipped.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1 text-gray-600">{row.row}</td>
                      <td className="px-2 py-1 text-gray-500">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={importing}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {importing ? (
            <>
              <svg
                className="ml-2 h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              מייבא...
            </>
          ) : (
            `ייבוא ${newCandidates.length + existingCandidates.length} מועמדים`
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={importing}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          חזרה
        </button>
      </div>
    </div>
  );
}
