"use client";

import { useState } from "react";
import type {
  SerializedParseResult,
  ImportResponse,
} from "@/app/dashboard/import/actions";
import { executeBulkImport } from "@/app/dashboard/import/actions";
import { UploadStep } from "./upload-step";
import { ReviewStep } from "./review-step";
import { SummaryStep } from "./summary-step";

type Step = "upload" | "review" | "summary";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "העלאת קובץ" },
  { key: "review", label: "סקירה" },
  { key: "summary", label: "סיכום" },
];

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [parseData, setParseData] = useState<SerializedParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse["summary"] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function handleParsed(data: SerializedParseResult) {
    setParseData(data);
    setImportError(null);
    setStep("review");
  }

  async function handleConfirmImport() {
    if (!parseData) return;

    setImporting(true);
    setImportError(null);
    try {
      const result = await executeBulkImport(
        parseData.uniqueWorkers,
        parseData.certTypeNames
      );

      if (!result.success) {
        setImportError(result.error || "שגיאה לא ידועה בייבוא");
      } else {
        setImportResult(result.summary ?? null);
        setStep("summary");
      }
    } catch {
      setImportError("שגיאה בביצוע הייבוא. נסו שנית");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setParseData(null);
    setImportResult(null);
    setImporting(false);
    setImportError(null);
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;

          return (
            <div key={s.key} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={`h-px w-8 sm:w-12 ${
                    isCompleted ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                <span
                  className={`hidden text-sm sm:inline ${
                    isActive ? "font-medium text-gray-900" : "text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Import error */}
      {importError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Active step */}
      {step === "upload" && <UploadStep onParsed={handleParsed} />}

      {step === "review" && parseData && (
        <ReviewStep
          data={parseData}
          onConfirm={handleConfirmImport}
          onBack={() => setStep("upload")}
          importing={importing}
        />
      )}

      {step === "summary" && importResult && (
        <SummaryStep summary={importResult} onReset={handleReset} />
      )}
    </div>
  );
}
