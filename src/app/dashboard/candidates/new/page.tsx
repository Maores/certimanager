import { requireUser } from "@/lib/supabase/auth";
import { CandidateForm } from "@/components/candidates/candidate-form";
import { createCandidate } from "@/app/dashboard/candidates/actions";

export default async function NewCandidatePage() {
  const { user, supabase } = await requireUser();

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("*")
    .eq("manager_id", user.id)
    .order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">הוספת מועמד חדש</h1>
      <div className="rounded-xl border border-border bg-white p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <CandidateForm action={createCandidate} certTypes={certTypes || []} />
      </div>
    </div>
  );
}
