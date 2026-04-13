import { notFound, redirect as navRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCertType } from "../../actions";
import Link from "next/link";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetCertType } from "@/lib/guest-store";
import { CertTypeEditForm } from "@/components/cert-types/cert-type-edit-form";

export default async function EditCertTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestSid = await getGuestSessionId();

  let certType: any;
  if (guestSid) {
    certType = guestGetCertType(guestSid, id);
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) navRedirect("/login");

    const { data } = await supabase
      .from("cert_types")
      .select("*")
      .eq("id", id)
      .eq("manager_id", user!.id)
      .single();
    certType = data;
  }

  if (!certType) {
    notFound();
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateCertType(id, formData);
    navRedirect("/dashboard/cert-types");
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/cert-types"
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <span aria-hidden="true">&rarr;</span> חזרה לסוגי הסמכות
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        עריכת סוג הסמכה: {certType.name}
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertTypeEditForm
          action={handleUpdate}
          defaultValues={{
            name: certType.name,
            default_validity_months: certType.default_validity_months,
            description: certType.description,
          }}
        />
      </div>
    </div>
  );
}
