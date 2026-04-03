import { createClient } from "@/lib/supabase/server";
import CertificationForm from "@/components/certifications/certification-form";

export default async function NewCertificationPage() {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("first_name");

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("*")
    .order("name");

  const { data: existingCerts } = await supabase
    .from("certifications")
    .select("employee_id, cert_type_id, expiry_date");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        הוספת הסמכה חדשה
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertificationForm
          employees={employees || []}
          certTypes={certTypes || []}
          existingCerts={existingCerts || []}
        />
      </div>
    </div>
  );
}
