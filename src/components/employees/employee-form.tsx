"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import type { Employee } from "@/types/database";

interface EmployeeFormProps {
  employee?: Employee;
  action: (formData: FormData) => Promise<void>;
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

export function EmployeeForm({ employee, action }: EmployeeFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await action(formData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה בשמירת הנתונים. נסה שוב";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* First Name */}
        <div>
          <label
            htmlFor="first_name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            שם פרטי
          </label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            required
            defaultValue={employee?.first_name ?? ""}
            className={inputClasses}
          />
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="last_name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            שם משפחה
          </label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            required
            defaultValue={employee?.last_name ?? ""}
            className={inputClasses}
          />
        </div>
      </div>

      {/* Employee Number */}
      <div>
        <label
          htmlFor="employee_number"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          מספר זהות/דרכון
        </label>
        <input
          type="text"
          id="employee_number"
          name="employee_number"
          required
          defaultValue={employee?.employee_number ?? ""}
          className={inputClasses}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Department */}
        <div>
          <label
            htmlFor="department"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            מחלקה
          </label>
          <input
            type="text"
            id="department"
            name="department"
            defaultValue={employee?.department ?? ""}
            className={inputClasses}
          />
        </div>

        {/* Status */}
        <div>
          <label
            htmlFor="status"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            סטטוס
          </label>
          <select
            id="status"
            name="status"
            defaultValue={employee?.status ?? "פעיל"}
            className={inputClasses}
          >
            <option value="פעיל">פעיל</option>
            <option value='חל"ת'>חל&quot;ת</option>
            <option value="מחלה">מחלה</option>
            <option value="לא פעיל">לא פעיל</option>
            <option value="ללא הסמכה - לבירור">ללא הסמכה - לבירור</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            טלפון
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            dir="ltr"
            defaultValue={employee?.phone ?? ""}
            className={`${inputClasses} text-left`}
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            אימייל
          </label>
          <input
            type="email"
            id="email"
            name="email"
            dir="ltr"
            defaultValue={employee?.email ?? ""}
            className={`${inputClasses} text-left`}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          הערות
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={employee?.notes ?? ""}
          className={`${inputClasses} resize-none`}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" strokeWidth={1.75} />
              שמור
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-muted hover:bg-gray-50 hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
          ביטול
        </button>
      </div>
    </form>
  );
}
