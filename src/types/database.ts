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
  issue_date: string;
  expiry_date: string;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithCerts extends Employee {
  certifications: (Certification & { cert_type: CertType })[];
}

export type CertStatus = "valid" | "expiring_soon" | "expired";

export function getCertStatus(expiryDate: string): CertStatus {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiry < now) return "expired";
  if (expiry < thirtyDaysFromNow) return "expiring_soon";
  return "valid";
}

export function formatDateHe(dateString: string): string {
  return new Date(dateString).toLocaleDateString("he-IL");
}

export function daysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
