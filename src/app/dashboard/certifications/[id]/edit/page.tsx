import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificationForm from "@/components/certifications/certification-form";
import Link from "next/link";

export default async function EditCertificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: certification } = await supabase
    .from("certifications")
    .select("*")
    .eq("id", id)
    .single();

  if (!certification) {
    notFound();
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("first_name");

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("*")
    .order("name");

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/certifications"
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        &rarr; חזרה להסמכות
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        עריכת הסמכה
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertificationForm
          employees={employees || []}
          certTypes={certTypes || []}
          certification={certification}
        />
      </div>
    </div>
  );
}
