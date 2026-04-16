import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployees, guestGetCertTypes, getGuestData } from "@/lib/guest-store";
import CertificationForm from "@/components/certifications/certification-form";

export default async function NewCertificationPage() {
  const guestSid = await getGuestSessionId();

  let employees: any[];
  let certTypesData: any[];
  let existingCerts: any[];

  if (guestSid) {
    const data = getGuestData(guestSid);
    employees = guestGetEmployees(guestSid);
    certTypesData = guestGetCertTypes(guestSid);
    existingCerts = data.certifications.map((c) => ({
      employee_id: c.employee_id,
      cert_type_id: c.cert_type_id,
      expiry_date: c.expiry_date,
    }));
  } else {
    const user = await getAuthenticatedUser();
    if (!user) redirect("/login");
    const supabase = await createClient();

    const { data: empData } = await supabase
      .from("employees")
      .select("*")
      .eq("manager_id", user!.id)
      .order("first_name");

    const { data: ctData } = await supabase
      .from("cert_types")
      .select("*")
      .eq("manager_id", user!.id)
      .order("name");

    const empIds = (empData || []).map((e: any) => e.id);
    const { data: ecData } = empIds.length > 0
      ? await supabase
          .from("certifications")
          .select("employee_id, cert_type_id, expiry_date")
          .in("employee_id", empIds)
      : { data: [] };

    employees = empData || [];
    certTypesData = ctData || [];
    existingCerts = ecData || [];
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        הוספת הסמכה חדשה
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertificationForm
          employees={employees}
          certTypes={certTypesData}
          existingCerts={existingCerts}
        />
      </div>
    </div>
  );
}
