"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Employee } from "@/types/database";

interface EmployeeFormProps {
  employee?: Employee;
  action: (formData: FormData) => Promise<void>;
}

export function EmployeeForm({ employee, action }: EmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await action(formData);
    } catch {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* First Name */}
        <div>
          <label
            htmlFor="first_name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            שם פרטי
          </label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            required
            defaultValue={employee?.first_name ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="last_name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            שם משפחה
          </label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            required
            defaultValue={employee?.last_name ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Employee Number */}
      <div>
        <label
          htmlFor="employee_number"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          מספר עובד
        </label>
        <input
          type="text"
          id="employee_number"
          name="employee_number"
          required
          defaultValue={employee?.employee_number ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Department */}
        <div>
          <label
            htmlFor="department"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            מחלקה
          </label>
          <input
            type="text"
            id="department"
            name="department"
            defaultValue={employee?.department ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Status */}
        <div>
          <label
            htmlFor="status"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            סטטוס
          </label>
          <select
            id="status"
            name="status"
            defaultValue={employee?.status ?? "פעיל"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="פעיל">פעיל</option>
            <option value="חלת">חלת</option>
            <option value="מחלה">מחלה</option>
            <option value="לא פעיל">לא פעיל</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            טלפון
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            dir="ltr"
            defaultValue={employee?.phone ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            אימייל
          </label>
          <input
            type="email"
            id="email"
            name="email"
            dir="ltr"
            defaultValue={employee?.email ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          הערות
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={employee?.notes ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {loading ? (
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
              שומר...
            </>
          ) : (
            "שמור"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
