import { createClient } from "@/lib/supabase/server";
import { createCertType, deleteCertType } from "./actions";
import { DeleteButton } from "@/components/ui/delete-button";

export default async function CertTypesPage() {
  const supabase = await createClient();

  const { data: certTypes, error } = await supabase
    .from("cert_types")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="text-red-600 p-4">
        שגיאה בטעינת סוגי הסמכות: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">סוגי הסמכות</h1>
      </div>

      {/* Add new cert type form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          הוסף סוג הסמכה חדש
        </h2>
        <form action={createCertType} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                שם
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="לדוגמה: עבודה בגובה"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="default_validity_months"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                תוקף ברירת מחדל (חודשים)
              </label>
              <input
                type="number"
                id="default_validity_months"
                name="default_validity_months"
                required
                min={1}
                defaultValue={12}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                תיאור
              </label>
              <input
                type="text"
                id="description"
                name="description"
                placeholder="תיאור קצר (אופציונלי)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            הוסף סוג
          </button>
        </form>
      </div>

      {/* Cert types list */}
      {!certTypes || certTypes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-lg">אין סוגי הסמכות עדיין</p>
          <p className="text-gray-400 text-sm mt-1">
            הוסף סוג הסמכה ראשון באמצעות הטופס למעלה
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {certTypes.map((ct: any) => (
            <div
              key={ct.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between">
                {/* Info */}
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{ct.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    תוקף: {ct.default_validity_months} חודשים
                    {ct.description && ` · ${ct.description}`}
                  </p>
                </div>

                {/* Actions - both buttons as simple inline elements */}
                <div className="flex items-center gap-4 flex-shrink-0 mr-4">
                  <a
                    href={`/dashboard/cert-types/${ct.id}/edit`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    עריכה
                  </a>
                  <DeleteButton
                    action={async () => {
                      "use server";
                      await deleteCertType(ct.id);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
