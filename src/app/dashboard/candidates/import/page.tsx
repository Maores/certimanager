import { CandidateImportWizard } from "@/components/candidates/candidate-import-wizard";

export default function CandidateImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">ייבוא מועמדים מקובץ</h1>
      <div className="rounded-xl border border-border bg-white p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <CandidateImportWizard />
      </div>
    </div>
  );
}
