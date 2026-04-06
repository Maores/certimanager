"use client";

import { useState, useRef } from "react";
import { Loader2, Save, Upload, X, FileText } from "lucide-react";
import type { Employee, CertType, Certification } from "@/types/database";
import {
  createCertification,
  updateCertification,
  uploadCertImage,
  deleteCertImage,
} from "@/app/dashboard/certifications/actions";

interface CertificationFormProps {
  employees: Employee[];
  certTypes: CertType[];
  certification?: Certification & {
    employee_id: string;
    cert_type_id: string;
  };
  defaultEmployeeId?: string;
  existingCerts?: { employee_id: string; cert_type_id: string; expiry_date: string | null }[];
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

/**
 * Safely adds months to a date, clamping to the last day of the target month
 * if the day overflows (e.g., Jan 31 + 1 month → Feb 28/29).
 */
function addMonthsSafe(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);

  // If the day changed due to overflow, clamp to last day of target month
  if (result.getDate() !== originalDay) {
    result.setDate(0);
  }

  return result;
}

export default function CertificationForm({
  employees,
  certTypes,
  certification,
  defaultEmployeeId,
  existingCerts = [],
}: CertificationFormProps) {
  const isEdit = !!certification;
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedEmployee, setSelectedEmployee] = useState(
    certification?.employee_id || defaultEmployeeId || ""
  );
  const [selectedCertType, setSelectedCertType] = useState(
    certification?.cert_type_id || ""
  );
  const [issueDate, setIssueDate] = useState(
    certification?.issue_date || ""
  );
  const [expiryDate, setExpiryDate] = useState(
    certification?.expiry_date || ""
  );
  const [imageUrl, setImageUrl] = useState(
    certification?.image_url || ""
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    certification?.image_url || null
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  function checkDuplicate(employeeId: string, certTypeId: string) {
    if (!employeeId || !certTypeId || isEdit) {
      setWarning(null);
      return;
    }
    const existing = existingCerts.find(
      (c) => c.employee_id === employeeId && c.cert_type_id === certTypeId
    );
    if (existing) {
      if (existing.expiry_date) {
        const expiry = new Date(existing.expiry_date);
        const now = new Date();
        if (expiry > now) {
          setWarning(
            `לעובד זה כבר יש הסמכה מסוג זה בתוקף (עד ${expiry.toLocaleDateString("he-IL")}). ההסמכה החדשה תחליף את הקיימת.`
          );
        } else {
          setWarning(
            `לעובד זה הייתה הסמכה מסוג זה שפג תוקפה (${expiry.toLocaleDateString("he-IL")}). ההסמכה החדשה תירשם כחידוש.`
          );
        }
      } else {
        setWarning(
          `לעובד זה כבר יש הסמכה מסוג זה (ללא תאריך תפוגה). ההסמכה החדשה תחליף את הקיימת.`
        );
      }
    } else {
      setWarning(null);
    }
  }

  function handleEmployeeChange(employeeId: string) {
    setSelectedEmployee(employeeId);
    checkDuplicate(employeeId, selectedCertType);
  }

  function handleCertTypeChange(certTypeId: string) {
    setSelectedCertType(certTypeId);
    checkDuplicate(selectedEmployee, certTypeId);

    if (issueDate && certTypeId) {
      const certType = certTypes.find((ct) => ct.id === certTypeId);
      if (certType) {
        const issue = addMonthsSafe(new Date(issueDate), certType.default_validity_months);
        setExpiryDate(issue.toISOString().split("T")[0]);
      }
    }
  }

  function handleIssueDateChange(date: string) {
    setIssueDate(date);

    if (selectedCertType && date) {
      const certType = certTypes.find((ct) => ct.id === selectedCertType);
      if (certType) {
        const issue = addMonthsSafe(new Date(date), certType.default_validity_months);
        setExpiryDate(issue.toISOString().split("T")[0]);
      }
    }
  }

  const isPdf = imageUrl?.endsWith(".pdf") || imagePreview?.startsWith("data:application/pdf");

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      alert("סוג קובץ לא נתמך. יש להעלות JPG, PNG, WebP או PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("הקובץ גדול מדי. הגודל המקסימלי הוא 5MB");
      return;
    }

    if (file.type !== "application/pdf") {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview("pdf");
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const path = await uploadCertImage(fd);
      setImageUrl(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה בהעלאת הקובץ";
      alert(msg);
      setImagePreview(certification?.image_url || null);
      setImageUrl(certification?.image_url || "");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveFile() {
    if (imageUrl && imageUrl !== certification?.image_url) {
      await deleteCertImage(imageUrl);
    }
    setImageUrl("");
    setImagePreview(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set("image_url", imageUrl);
    formData.set("expiry_date", expiryDate);

    if (isEdit && certification) {
      await updateCertification(certification.id, formData);
    } else {
      await createCertification(formData);
    }
    setSubmitting(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Employee select */}
      <div>
        <label
          htmlFor="employee_id"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          עובד
        </label>
        <select
          id="employee_id"
          name="employee_id"
          required
          value={selectedEmployee}
          onChange={(e) => handleEmployeeChange(e.target.value)}
          className={inputClasses}
        >
          <option value="" disabled>
            בחר עובד...
          </option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Cert type select */}
      <div>
        <label
          htmlFor="cert_type_id"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          סוג הסמכה
        </label>
        <select
          id="cert_type_id"
          name="cert_type_id"
          required
          value={selectedCertType}
          onChange={(e) => handleCertTypeChange(e.target.value)}
          className={inputClasses}
        >
          <option value="" disabled>
            בחר סוג הסמכה...
          </option>
          {certTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name} ({ct.default_validity_months} חודשים)
            </option>
          ))}
        </select>
      </div>

      {/* Warning for duplicate cert */}
      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">{warning}</p>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="issue_date"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            תאריך הנפקה
          </label>
          <input
            type="date"
            id="issue_date"
            name="issue_date"
            required
            value={issueDate}
            onChange={(e) => handleIssueDateChange(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label
            htmlFor="expiry_date"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            תאריך תפוגה
          </label>
          <input
            type="date"
            id="expiry_date"
            name="expiry_date"
            required
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>

      {/* File upload */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          קובץ הסמכה
        </label>
        <div className="flex items-start gap-4">
          {imagePreview && (
            <div className="relative w-24 h-24 flex-shrink-0">
              <div className="w-full h-full rounded-lg border border-border overflow-hidden bg-gray-50">
                {imagePreview === "pdf" || isPdf ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                    <FileText className="h-8 w-8 text-red-500" strokeWidth={1.5} />
                    <span className="text-[10px] text-red-600 mt-1 font-medium">PDF</span>
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imagePreview}
                    alt="תצוגה מקדימה"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-danger text-white flex items-center justify-center hover:bg-red-700 transition-colors cursor-pointer"
                style={{ boxShadow: "var(--shadow-sm)" }}
                title="הסר קובץ"
              >
                <X className="h-3.5 w-3.5" strokeWidth={3} />
              </button>
            </div>
          )}
          <div className="flex-1">
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploading
                  ? "border-primary/40 bg-primary-light"
                  : "border-border bg-gray-50 hover:border-primary/40 hover:bg-primary-light/50"
              }`}
            >
              {uploading ? (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">מעלה קובץ...</span>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" strokeWidth={1.5} />
                  <span className="text-xs text-muted">
                    לחץ לבחירת קובץ
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    JPG, PNG, PDF עד 5MB
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <input type="hidden" name="image_url" value={imageUrl} />
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          הערות
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={certification?.notes || ""}
          className={`${inputClasses} resize-none`}
          placeholder="הערות נוספות..."
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {submitting ? (
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
        <a
          href="/dashboard/certifications"
          className="inline-flex items-center gap-1.5 text-muted hover:text-foreground px-4 py-2 text-sm font-medium transition-colors"
        >
          ביטול
        </a>
      </div>
    </form>
  );
}
