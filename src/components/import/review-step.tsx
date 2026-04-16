"use client";

import type { SerializedParseResult } from "@/app/dashboard/import/actions";

interface ReviewStepProps {
  data: SerializedParseResult;
  onConfirm: () => void;
  onBack: () => void;
  importing: boolean;
}

export function ReviewStep({ data, onConfirm, onBack, importing }: ReviewStepProps) {
  const newWorkers = data.uniqueWorkers.filter((w) => !w.existsInDb);
  const existingWorkers = data.uniqueWorkers.filter((w) => w.existsInDb);

  const stats = [
    { label: "שורות שנקראו", value: data.totalParsed, color: "text-gray-900" },
    { label: "עובדים ייחודיים", value: data.uniqueWorkers.length, color: "text-blue-700" },
    { label: "עובדים חדשים", value: newWorkers.length, color: "text-green-700" },
    { label: "עובדים קיימים", value: existingWorkers.length, color: "text-gray-600" },
    { label: "ללא הסמכות", value: data.noCertWorkerCount, color: "text-yellow-700" },
    { label: "שורות שדולגו", value: data.totalSkipped, color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

      {/* Cert types info box */}
      {data.certTypeNames.length > 0 && (
        <div className="rounded-lg bg-blue-50 p-4">
          <p className="mb-2 text-sm font-medium text-blue-800">
            סוגי הסמכות שייווצרו ({data.certTypeNames.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {data.certTypeNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Workers table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs font-medium text-gray-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">שם</th>
              <th className="px-3 py-2">מספר זהות</th>
              <th className="px-3 py-2">סטטוס</th>
              <th className="px-3 py-2">הסמכות</th>
              <th className="px-3 py-2">מצב</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.uniqueWorkers.map((worker, idx) => (
              <tr
                key={worker.employeeNumber}
                className={
                  worker.existsInDb
                    ? "bg-gray-50"
                    : "bg-green-50/30"
                }
              >
                <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {worker.firstName} {worker.lastName}
                </td>
                <td className="px-3 py-2 text-gray-600" dir="ltr">
                  {worker.employeeNumber}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      worker.statusWarning
                        ? "inline-flex items-center gap-1 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
                        : "text-gray-700"
                    }
                  >
                    {worker.statusWarning && "⚠️ "}
                    {worker.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {worker.certTypeNames.map((ct) => {
                      const isExisting = worker.existingCertTypes.includes(ct);
                      const dates = worker.certDatesByType[ct];
                      const dateLine = dates
                        ? [
                            dates.issue_date && `הונפקה ${dates.issue_date}`,
                            dates.expiry_date && `פג תוקף ${dates.expiry_date}`,
                            dates.next_refresh_date && `רענון ${dates.next_refresh_date}`,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : "";
                      return (
                        <div key={ct} className="flex flex-col">
                          <span
                            className={
                              isExisting
                                ? "rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-500 line-through"
                                : "rounded bg-green-100 px-2 py-0.5 text-xs text-green-800"
                            }
                          >
                            {ct}
                          </span>
                          {dateLine && (
                            <span className="mt-0.5 text-[10px] text-gray-500">
                              {dateLine}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {worker.certTypeNames.length === 0 && (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {worker.existsInDb ? (
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
      </div>

      {/* Skipped rows */}
      {data.skippedRows.length > 0 && (
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            שורות שדולגו ({data.skippedRows.length})
          </summary>
          <div className="border-t border-gray-200 p-4">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-right text-gray-500">
                  <tr>
                    <th className="px-2 py-1">גיליון</th>
                    <th className="px-2 py-1">שורה</th>
                    <th className="px-2 py-1">סיבה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.skippedRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1 text-gray-600">{row.sheet}</td>
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
            `ייבוא ${data.uniqueWorkers.length} עובדים`
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
