import { requireUser } from "@/lib/supabase/auth";
import { createCertType, deleteCertType } from "./actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { CertTypeCreateForm } from "@/components/cert-types/cert-type-create-form";
import { Tag, Clock } from "lucide-react";
import { getGuestSessionId } from "@/lib/guest-session";
import { guestGetCertTypes } from "@/lib/guest-store";

export default async function CertTypesPage() {
  const guestSid = await getGuestSessionId();

  let certTypes: any[] | null;
  let error: any = null;

  if (guestSid) {
    certTypes = guestGetCertTypes(guestSid);
  } else {
    const { user, supabase } = await requireUser();

    const result = await supabase
      .from("cert_types")
      .select("*")
      .eq("manager_id", user.id)
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
        <CertTypeCreateForm action={createCertType} />
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
