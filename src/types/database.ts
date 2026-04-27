export interface Manager {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Employee {
  id: string;
  manager_id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department: string;
  phone: string;
  email: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertType {
  id: string;
  manager_id: string;
  name: string;
  default_validity_months: number;
  description: string | null;
}

export interface Certification {
  id: string;
  employee_id: string;
  cert_type_id: string;
  cert_type_name?: string;
  issue_date: string | null;
  expiry_date: string | null;
  next_refresh_date: string | null;
  image_url: string | null;
  image_filename: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeTask {
  id: string;
  employee_id: string;
  description: string;
  responsible: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "פתוח" | "בטיפול" | "הושלם";

export type CandidateStatus = "ממתין" | "נרשם" | "השלים" | "הוסמך";

export const CANDIDATE_STATUSES: CandidateStatus[] = ["ממתין", "נרשם", "השלים", "הוסמך"];

export interface CourseCandidate {
  id: string;
  manager_id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  phone: string | null;
  city: string | null;
  cert_type_id: string;
  cert_type_name?: string;
  status: CandidateStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_employee?: boolean;
}

export interface EmployeeWithCerts extends Employee {
  certifications: (Certification & { cert_type: CertType })[];
}

export interface EmployeeWithCertsAndTasks extends Employee {
  certifications: (Certification & { cert_type: CertType })[];
  employee_tasks: EmployeeTask[];
}

export type CertStatus = "valid" | "expiring_soon" | "expired" | "unknown";

export function getCertStatus(
  expiryDate: string | null,
  nextRefreshDate?: string | null,
): CertStatus {
  // Effective deadline is the earlier of the two populated dates.
  const dates = [expiryDate, nextRefreshDate].filter(
    (d): d is string => !!d,
  );
  if (dates.length === 0) return "unknown";
  // Dates are "YYYY-MM-DD" and lexicographically comparable.
  const effective = dates.reduce((a, b) => (a < b ? a : b));

  // Normalize to date-only comparison (YYYY-MM-DD) to avoid timezone issues
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (effective < todayStr) return "expired";

  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyStr = `${thirtyDays.getFullYear()}-${String(thirtyDays.getMonth() + 1).padStart(2, '0')}-${String(thirtyDays.getDate()).padStart(2, '0')}`;

  if (effective <= thirtyStr) return "expiring_soon";
  return "valid";
}

export function formatDateHe(dateString: string | null): string {
  if (!dateString) return "—";
  // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone shift
  const parts = dateString.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("he-IL");
  }
  return new Date(dateString).toLocaleDateString("he-IL");
}

export function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  // Parse both as local dates for consistent comparison
  const [y, m, d] = expiryDate.split('-').map(Number);
  const expiry = new Date(y, m - 1, d); // local midnight
  const now = new Date();
  now.setHours(0, 0, 0, 0); // local midnight
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export interface CertRow {
  id: string;
  employee_name: string;
  employee_department: string;
  cert_type_id: string;
  cert_type_name: string;
  issue_date: string | null;
  expiry_date: string | null;
  next_refresh_date: string | null;
  image_url: string | null;
  image_filename: string | null;
  status: CertStatus;
}
