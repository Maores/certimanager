import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetEmployees, guestGetCertTypes, getGuestData } from "@/lib/guest-store";
import CertificationForm from "@/components/certifications/certification-form";
import Link from "next/link";

export default async function EditCertificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestSid = await getGuestSessionId();

  let certification: any;
  let employees: any[];
  let certTypesData: any[];

  if (guestSid) {
    const data = getGuestData(guestSid);
    certification = data.certifications.find((c) => c.id === id) || null;
    employees = guestGetEmployees(guestSid);
    certTypesData = guestGetCertTypes(guestSid);
  } else {
    const { user, supabase } = await requireUser();

    const { data: certData } = await supabase
      .from("certifications")
      .select("*, employees!inner(manager_id)")
      .eq("id", id)
      .eq("employees.manager_id", user.id)
      .single();

    certification = certData;

    const { data: empData } = await supabase
      .from("employees")
      .select("*")
      .eq("manager_id", user.id)
      .order("first_name");

    const { data: ctData } = await supabase
      .from("cert_types")
      .select("*")
      .eq("manager_id", user.id)
      .order("name");

    employees = empData || [];
    certTypesData = ctData || [];
  }

  if (!certification) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/certifications"
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <span aria-hidden="true">&rarr;</span> חזרה להסמכות
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        עריכת הסמכה
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertificationForm
          employees={employees}
          certTypes={certTypesData}
          certification={certification}
        />
      </div>
    </div>
  );
}
