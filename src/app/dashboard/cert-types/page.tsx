import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCertType, deleteCertType } from "./actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { Plus, Tag, Clock } from "lucide-react";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetCertTypes } from "@/lib/guest-store";

export default async function CertTypesPage() {
  const guestSid = await getGuestSessionId();

  let certTypes: any[] | null;
  let error: any = null;

  if (guestSid) {
    certTypes = guestGetCertTypes(guestSid);
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const result = await supabase
      .from("cert_types")
      .select("*")
      .eq("manager_id", user!.id)
      .order("name", { ascending: true });
    certTypes = result.data;
    error = result.error;
  }

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
        <h1 className="text-2xl font-bold text-foreground">סוגי הסמכות</h1>
      </div>

      {/* Add new cert type form */}
      <div
        className="bg-card rounded-xl border border-border p-6"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">
          הוסף סוג הסמכה חדש
        </h2>
        <form action={createCertType} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground mb-1"
              >
                שם
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                placeholder="לדוגמה: עבודה בגובה"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="default_validity_months"
                className="block text-sm font-medium text-foreground mb-1"
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
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-foreground mb-1"
              >
                תיאור
              </label>
              <input
                type="text"
                id="description"
                name="description"
                placeholder="תיאור קצר (אופציונלי)"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            הוסף סוג
          </button>
        </form>
      </div>

      {/* Cert types list */}
      {!certTypes || certTypes.length === 0 ? (
        <div
          className="text-center py-12 bg-card rounded-xl border border-border"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted text-lg font-medium">אין סוגי הסמכות עדיין</p>
          <p className="text-muted-foreground text-sm mt-1">
            הוסף סוג הסמכה ראשון באמצעות הטופס למעלה
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {certTypes.map((ct: any) => (
            <div
              key={ct.id}
              className="bg-card rounded-xl border border-border border-r-2 border-r-primary/20 p-4 hover:shadow-[var(--shadow-sm)] transition-all duration-150"
              style={{ boxShadow: "var(--shadow-xs)" }}
            >
              <div className="flex items-center justify-between">
                {/* Info */}
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{ct.name}</h3>
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span>תוקף: {ct.default_validity_months} חודשים</span>
                    {ct.description && (
                      <span className="text-muted-foreground"> · {ct.description}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 flex-shrink-0 mr-4">
                  <a
                    href={`/dashboard/cert-types/${ct.id}/edit`}
                    className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
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
