"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Save, X, UserCheck } from "lucide-react";
import type { CertType } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import { checkEmployeeByIdNumber } from "@/app/dashboard/candidates/actions";

interface CandidateFormProps {
  action: (formData: FormData) => Promise<void>;
  certTypes: CertType[];
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

export function CandidateForm({ action, certTypes }: CandidateFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeMatch, setEmployeeMatch] = useState<{ found: boolean; name?: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      await action(formData);
    } catch (e) {
      // Next.js signals redirect() via a thrown error with digest "NEXT_REDIRECT;...".
      // Re-throw so Next.js intercepts it and performs the navigation.
      if (e instanceof Error && "digest" in e && typeof e.digest === "string" && e.digest.startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : "שגיאה בשמירת הנתונים. נסה שוב";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleIdBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.target.value.trim();
    if (value.length >= 5) {
      try {
        const result = await checkEmployeeByIdNumber(value);
        setEmployeeMatch(result);
      } catch {
        setEmployeeMatch(null);
      }
    } else {
      setEmployeeMatch(null);
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
            שם פרטי <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            required
            maxLength={50}
            className={inputClasses}
          />
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="last_name"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            שם משפחה <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            required
            maxLength={50}
            className={inputClasses}
          />
        </div>
      </div>

      {/* ID Number */}
      <div>
        <label
          htmlFor="id_number"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          ת.ז <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          id="id_number"
          name="id_number"
          required
          maxLength={20}
          onBlur={handleIdBlur}
          className={inputClasses}
        />
        {employeeMatch?.found && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <UserCheck className="h-3.5 w-3.5" />
            עובד קיים: {employeeMatch.name}
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            מס׳ טלפון
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            dir="ltr"
            maxLength={20}
            className={`${inputClasses} text-left`}
          />
        </div>

        {/* City */}
        <div>
          <label
            htmlFor="city"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            מקום מגורים
          </label>
          <input
            type="text"
            id="city"
            name="city"
            maxLength={50}
            className={inputClasses}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Cert Type */}
        <div>
          <label
            htmlFor="cert_type_id"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            סוג הסמכה <span className="text-danger">*</span>
          </label>
          <select
            id="cert_type_id"
            name="cert_type_id"
            required
            defaultValue=""
            className={inputClasses}
          >
            <option value="" disabled>בחר סוג הסמכה</option>
            {certTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
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
            defaultValue="ממתין"
            className={inputClasses}
          >
            {CANDIDATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
          maxLength={500}
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
          onClick={() => router.push("/dashboard/candidates")}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-muted hover:bg-gray-50 hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
          ביטול
        </button>
      </div>
    </form>
  );
}
