import { createClient } from "@/lib/supabase/server";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployee, guestGetCertTypes, guestGetCertsByEmployee } from "@/lib/guest-store";
import { notFound, redirect } from "next/navigation";
import CertificationForm from "@/components/certifications/certification-form";

export default async function NewCertificationForEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestSid = await getGuestSessionId();

  let employee: any;
  let certTypesData: any[];
  let existingCerts: any[];

  if (guestSid) {
    employee = guestGetEmployee(guestSid, id);
    if (!employee) {
      notFound();
    }
    certTypesData = guestGetCertTypes(guestSid);
    existingCerts = guestGetCertsByEmployee(guestSid, id).map((c) => ({
      employee_id: c.employee_id,
      cert_type_id: c.cert_type_id,
      expiry_date: c.expiry_date,
    }));
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: empData } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("manager_id", user!.id)
      .single();

    employee = empData;

    if (!employee) {
      notFound();
    }

    const { data: ctData } = await supabase
      .from("cert_types")
      .select("*")
      .eq("manager_id", user!.id)
      .order("name");

    const { data: ecData } = await supabase
      .from("certifications")
      .select("employee_id, cert_type_id, expiry_date")
      .eq("employee_id", id);

    certTypesData = ctData || [];
    existingCerts = ecData || [];
  }

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
          certTypes={certTypesData}
          defaultEmployeeId={id}
          existingCerts={existingCerts}
        />
      </div>
    </div>
  );
}
