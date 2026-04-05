import { ImportWizard } from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ייבוא מאקסל</h1>
        <p className="mt-1 text-sm text-gray-500">
          ייבוא עובדים והסמכות מקובץ Excel
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
