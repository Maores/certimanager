import { notFound, redirect as navRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCertType } from "../../actions";
import Link from "next/link";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetCertType } from "@/lib/guest-store";

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
        &rarr; חזרה לסוגי הסמכות
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        עריכת סוג הסמכה: {certType.name}
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <form action={handleUpdate} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              שם
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={certType.name}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="default_validity_months" className="block text-sm font-medium text-gray-700 mb-1">
              תוקף ברירת מחדל (חודשים)
            </label>
            <input
              type="number"
              id="default_validity_months"
              name="default_validity_months"
              required
              min={1}
              defaultValue={certType.default_validity_months}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              תיאור
            </label>
            <input
              type="text"
              id="description"
              name="description"
              defaultValue={certType.description || ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              עדכן
            </button>
            <Link
              href="/dashboard/cert-types"
              className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium"
            >
              ביטול
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
