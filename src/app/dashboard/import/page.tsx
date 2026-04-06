import { ImportWizard } from "@/components/import/import-wizard";
import { isGuestSession } from "@/lib/guest-session";
import { FileX } from "lucide-react";

export default async function ImportPage() {
  const guest = await isGuestSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ייבוא מאקסל</h1>
        <p className="mt-1 text-sm text-gray-500">
          ייבוא עובדים והסמכות מקובץ Excel
        </p>
      </div>
      {guest ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <FileX className="h-7 w-7 text-amber-600" />
          </div>
          <p className="text-lg font-medium text-muted">ייבוא לא זמין במצב אורח</p>
          <p className="mt-1 text-sm text-muted-foreground">
            התחבר עם חשבון כדי לייבא עובדים מקובץ Excel
          </p>
        </div>
      ) : (
        <ImportWizard />
      )}
    </div>
  );
}
