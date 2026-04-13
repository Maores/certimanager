"use client";

import { useState } from "react";
import type {
  CandidateImportPreview,
  CandidateImportResult,
} from "@/app/dashboard/candidates/actions";
import { executeCandidateImport } from "@/app/dashboard/candidates/actions";
import { CandidateUploadStep } from "./candidate-upload-step";
import { CandidateReviewStep } from "./candidate-review-step";
import { CandidateSummaryStep } from "./candidate-summary-step";

type Step = "upload" | "review" | "summary";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "העלאת קובץ" },
  { key: "review", label: "סקירה" },
  { key: "summary", label: "סיכום" },
];

export function CandidateImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<CandidateImportPreview | null>(null);
  const [result, setResult] = useState<CandidateImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function handleParsed(data: CandidateImportPreview) {
    setPreview(data);
    setImportError(null);
    setStep("review");
  }

  async function handleConfirmImport() {
    if (!preview) return;

    setImporting(true);
    setImportError(null);
    try {
      // Prepare candidates for import - map cert_type_name to cert_type_id
      const toImport = preview.candidates
        .filter((c) => c.cert_type_name && preview.certTypeMap[c.cert_type_name])
        .map((c) => ({
          first_name: c.first_name,
          last_name: c.last_name,
          id_number: c.id_number,
          phone: c.phone,
          city: c.city,
          cert_type_id: preview.certTypeMap[c.cert_type_name!],
          status: c.status || "ממתין",
          notes: null,
        }));

      const importResult = await executeCandidateImport(toImport);
      setResult(importResult);
      setStep("summary");
    } catch {
      setImportError("שגיאה בביצוע הייבוא. נסו שנית");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setImporting(false);
    setImportError(null);
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <ol aria-label="שלבי ייבוא מועמדים" className="flex items-center justify-center gap-2">
        {STEPS.map((s, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;

          return (
            <li
              key={s.key}
              aria-current={isActive ? "step" : undefined}
              aria-label={`שלב ${idx + 1}: ${s.label}${isCompleted ? " (הושלם)" : ""}`}
              className="flex items-center gap-2"
            >
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
            </li>
          );
        })}
      </ol>

      {/* Import error */}
      {importError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Active step */}
      {step === "upload" && <CandidateUploadStep onParsed={handleParsed} />}

      {step === "review" && preview && (
        <CandidateReviewStep
          data={preview}
          onConfirm={handleConfirmImport}
          onBack={() => setStep("upload")}
          importing={importing}
        />
      )}

      {step === "summary" && result && (
        <CandidateSummaryStep result={result} onReset={handleReset} />
      )}
    </div>
  );
}
