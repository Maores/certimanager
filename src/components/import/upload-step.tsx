"use client";

import { useState, useRef, useCallback } from "react";
import type { SerializedParseResult } from "@/app/dashboard/import/actions";
import { parseExcelFile } from "@/app/dashboard/import/actions";

interface UploadStepProps {
  onParsed: (data: SerializedParseResult) => void;
}

export function UploadStep({ onParsed }: UploadStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      // Client-side validation
      if (!file.name.endsWith(".xlsx")) {
        setError("יש להעלות קובץ בפורמט xlsx בלבד");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("הקובץ גדול מדי. הגודל המקסימלי הוא 5MB");
        return;
      }

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await parseExcelFile(formData);

        if (!result.success || !result.data) {
          setError(result.error || "שגיאה לא ידועה");
        } else {
          onParsed(result.data);
        }
      } catch {
        setError("שגיאה בהעלאת הקובץ. נסו שנית");
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="העלאת קובץ Excel"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-8 w-8 animate-spin text-blue-600"
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
            <p className="text-sm font-medium text-gray-700">מעבד את הקובץ...</p>
          </div>
        ) : (
          <>
            <span className="mb-3 text-4xl">📥</span>
            <p className="text-sm font-medium text-gray-700">
              גררו קובץ Excel לכאן או לחצו לבחירה
            </p>
            <p className="mt-1 text-xs text-gray-500">
              קובץ xlsx בלבד, עד 5MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
