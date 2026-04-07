/**
 * In-memory guest data store.
 * Each guest session gets isolated data seeded with sample records.
 * Data persists across page navigations (same server process) but
 * is cleared on logout or server restart.
 */

import type { Employee, CertType, Certification } from "@/types/database";

interface GuestData {
  employees: Employee[];
  certTypes: CertType[];
  certifications: Certification[];
}

// Use globalThis to share state across Turbopack module instances
// (server actions and server components may get different module evaluations)
const globalKey = "__certimanager_guest_sessions__";
const sessions: Map<string, GuestData> =
  (globalThis as Record<string, unknown>)[globalKey] as Map<string, GuestData> ??
  ((globalThis as Record<string, unknown>)[globalKey] = new Map<string, GuestData>());

function seed(): GuestData {
  const now = new Date().toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const sixtyDays = new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0];
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
  const fiveDays = new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0];

  const employees: Employee[] = [
    { id: "g-emp-1", manager_id: "guest", first_name: "ישראל", last_name: "כהן", employee_number: "1001", department: "הנדסה", phone: "050-1234567", email: "israel@example.com", status: "פעיל", notes: null, created_at: now, updated_at: now },
    { id: "g-emp-2", manager_id: "guest", first_name: "שרה", last_name: "לוי", employee_number: "1002", department: "הנדסה", phone: "050-2345678", email: "sarah@example.com", status: "פעיל", notes: null, created_at: now, updated_at: now },
    { id: "g-emp-3", manager_id: "guest", first_name: "דוד", last_name: "אברהם", employee_number: "1003", department: "תפעול", phone: "050-3456789", email: "david@example.com", status: "פעיל", notes: null, created_at: now, updated_at: now },
    { id: "g-emp-4", manager_id: "guest", first_name: "רחל", last_name: "מזרחי", employee_number: "1004", department: "תפעול", phone: "050-4567890", email: "rachel@example.com", status: "פעיל", notes: null, created_at: now, updated_at: now },
    { id: "g-emp-5", manager_id: "guest", first_name: "משה", last_name: "פרץ", employee_number: "1005", department: "בטיחות", phone: "050-5678901", email: "moshe@example.com", status: "לא פעיל", notes: "בחופשה", created_at: now, updated_at: now },
  ];

  const certTypes: CertType[] = [
    { id: "g-ct-1", manager_id: "guest", name: "עבודה בגובה", default_validity_months: 12, description: "הסמכה לעבודה בגובה" },
    { id: "g-ct-2", manager_id: "guest", name: "בטיחות כללית", default_validity_months: 24, description: "הכשרת בטיחות כללית" },
    { id: "g-ct-3", manager_id: "guest", name: "עזרה ראשונה", default_validity_months: 12, description: "הכשרת עזרה ראשונה" },
  ];

  const certifications: Certification[] = [
    { id: "g-cert-1", employee_id: "g-emp-1", cert_type_id: "g-ct-1", issue_date: "2025-06-01", expiry_date: sixtyDays, image_url: null, notes: null, created_at: now, updated_at: now },
    { id: "g-cert-2", employee_id: "g-emp-1", cert_type_id: "g-ct-2", issue_date: "2025-01-15", expiry_date: tenDaysAgo, image_url: null, notes: null, created_at: now, updated_at: now },
    { id: "g-cert-3", employee_id: "g-emp-2", cert_type_id: "g-ct-1", issue_date: "2025-08-01", expiry_date: fiveDays, image_url: null, notes: null, created_at: now, updated_at: now },
    { id: "g-cert-4", employee_id: "g-emp-3", cert_type_id: "g-ct-3", issue_date: "2025-03-10", expiry_date: thirtyDays, image_url: null, notes: null, created_at: now, updated_at: now },
    { id: "g-cert-5", employee_id: "g-emp-4", cert_type_id: "g-ct-2", issue_date: "2025-09-01", expiry_date: sixtyDays, image_url: null, notes: null, created_at: now, updated_at: now },
  ];

  return { employees, certTypes, certifications };
}

export function getGuestData(sessionId: string): GuestData {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, seed());
  }
  return sessions.get(sessionId)!;
}

export function clearGuestSession(sessionId: string) {
  sessions.delete(sessionId);
}

// ── Employee operations ──

export function guestGetEmployees(sid: string, q?: string, dept?: string): Employee[] {
  const data = getGuestData(sid);
  let result = [...data.employees];
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter(
      (e) =>
        e.first_name.toLowerCase().includes(lower) ||
        e.last_name.toLowerCase().includes(lower) ||
        e.employee_number.toLowerCase().includes(lower) ||
        e.department.toLowerCase().includes(lower)
    );
  }
  if (dept) {
    result = result.filter((e) => e.department === dept);
  }
  return result.sort((a, b) => a.first_name.localeCompare(b.first_name, "he"));
}

export function guestGetEmployee(sid: string, id: string): Employee | null {
  return getGuestData(sid).employees.find((e) => e.id === id) || null;
}

export function guestCreateEmployee(sid: string, emp: Omit<Employee, "id" | "manager_id" | "created_at" | "updated_at">): Employee {
  const data = getGuestData(sid);
  const now = new Date().toISOString();
  const newEmp: Employee = {
    ...emp,
    id: `g-emp-${Date.now()}`,
    manager_id: "guest",
    created_at: now,
    updated_at: now,
  };
  data.employees.push(newEmp);
  return newEmp;
}

export function guestUpdateEmployee(sid: string, id: string, updates: Partial<Employee>): boolean {
  const data = getGuestData(sid);
  const idx = data.employees.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  data.employees[idx] = { ...data.employees[idx], ...updates, updated_at: new Date().toISOString() };
  return true;
}

export function guestDeleteEmployee(sid: string, id: string): boolean {
  const data = getGuestData(sid);
  const before = data.employees.length;
  data.employees = data.employees.filter((e) => e.id !== id);
  // Cascade delete certifications
  data.certifications = data.certifications.filter((c) => c.employee_id !== id);
  return data.employees.length < before;
}

export function guestDeleteEmployees(sid: string, ids: string[]): number {
  const data = getGuestData(sid);
  const idSet = new Set(ids);
  const before = data.employees.length;
  data.employees = data.employees.filter((e) => !idSet.has(e.id));
  data.certifications = data.certifications.filter((c) => !idSet.has(c.employee_id));
  return before - data.employees.length;
}

export function guestGetDepartments(sid: string): string[] {
  const data = getGuestData(sid);
  return [...new Set(data.employees.map((e) => e.department).filter(Boolean))].sort();
}

// ── Cert Type operations ──

export function guestGetCertTypes(sid: string): CertType[] {
  return [...getGuestData(sid).certTypes].sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export function guestGetCertType(sid: string, id: string): CertType | null {
  return getGuestData(sid).certTypes.find((ct) => ct.id === id) || null;
}

export function guestCreateCertType(sid: string, ct: Omit<CertType, "id" | "manager_id">): CertType {
  const data = getGuestData(sid);
  const newCt: CertType = { ...ct, id: `g-ct-${Date.now()}`, manager_id: "guest" };
  data.certTypes.push(newCt);
  return newCt;
}

export function guestUpdateCertType(sid: string, id: string, updates: Partial<CertType>): boolean {
  const data = getGuestData(sid);
  const idx = data.certTypes.findIndex((ct) => ct.id === id);
  if (idx === -1) return false;
  data.certTypes[idx] = { ...data.certTypes[idx], ...updates };
  return true;
}

export function guestDeleteCertType(sid: string, id: string): boolean {
  const data = getGuestData(sid);
  const before = data.certTypes.length;
  data.certTypes = data.certTypes.filter((ct) => ct.id !== id);
  return data.certTypes.length < before;
}

// ── Certification operations ──

export function guestGetCertifications(sid: string) {
  const data = getGuestData(sid);
  return data.certifications.map((cert) => {
    const emp = data.employees.find((e) => e.id === cert.employee_id);
    const ct = data.certTypes.find((t) => t.id === cert.cert_type_id);
    return {
      ...cert,
      employees: emp ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, department: emp.department } : null,
      cert_types: ct ? { id: ct.id, name: ct.name } : null,
    };
  });
}

export function guestGetCertification(sid: string, id: string) {
  const data = getGuestData(sid);
  const cert = data.certifications.find((c) => c.id === id);
  if (!cert) return null;
  const emp = data.employees.find((e) => e.id === cert.employee_id);
  const ct = data.certTypes.find((t) => t.id === cert.cert_type_id);
  return {
    ...cert,
    employees: emp ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, department: emp.department } : null,
    cert_types: ct ? { id: ct.id, name: ct.name } : null,
  };
}

export function guestGetCertsByEmployee(sid: string, employeeId: string) {
  const data = getGuestData(sid);
  return data.certifications
    .filter((c) => c.employee_id === employeeId)
    .map((cert) => {
      const ct = data.certTypes.find((t) => t.id === cert.cert_type_id);
      return { ...cert, cert_types: ct ? { id: ct.id, name: ct.name } : null };
    });
}

export function guestCreateCertification(sid: string, cert: Omit<Certification, "id" | "created_at" | "updated_at">): Certification {
  const data = getGuestData(sid);
  const now = new Date().toISOString();
  const newCert: Certification = {
    ...cert,
    id: `g-cert-${Date.now()}`,
    created_at: now,
    updated_at: now,
  };
  data.certifications.push(newCert);
  return newCert;
}

export function guestUpdateCertification(sid: string, id: string, updates: Partial<Certification>): boolean {
  const data = getGuestData(sid);
  const idx = data.certifications.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  data.certifications[idx] = { ...data.certifications[idx], ...updates, updated_at: new Date().toISOString() };
  return true;
}

export function guestDeleteCertification(sid: string, id: string): boolean {
  const data = getGuestData(sid);
  const before = data.certifications.length;
  data.certifications = data.certifications.filter((c) => c.id !== id);
  return data.certifications.length < before;
}

export function guestGetEmployeeCount(sid: string): number {
  return getGuestData(sid).employees.length;
}

/**
 * Check whether a guest session ID is registered in the in-memory store.
 * Used by middleware to validate the guest_session cookie value.
 * NOTE: This helper deliberately does NOT call getGuestData (which auto-seeds),
 * so an unknown/forged session ID returns false without creating a new session.
 */
export function hasGuestSession(sessionId: string): boolean {
  return sessions.has(sessionId);
}
