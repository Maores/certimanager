import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CertificationForm from "@/components/certifications/certification-form";

export default async function NewCertificationForEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (!employee) {
    notFound();
  }

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("*")
    .order("name");

  const { data: existingCerts } = await supabase
    .from("certifications")
    .select("employee_id, cert_type_id, expiry_date")
    .eq("employee_id", id);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        הוספת הסמכה
      </h1>
      <p className="text-gray-500 mb-6">
        עבור {employee.first_name} {employee.last_name}
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertificationForm
          employees={[employee]}
          certTypes={certTypes || []}
          defaultEmployeeId={id}
          existingCerts={existingCerts || []}
        />
      </div>
    </div>
  );
}
