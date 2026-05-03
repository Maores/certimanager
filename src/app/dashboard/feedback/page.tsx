import { redirect } from "next/navigation";
import { MessageSquareWarning, Inbox } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { MarkReadButton } from "./mark-read-button";
import { DeleteFeedbackButton } from "./delete-feedback-button";

type Category = "bug" | "suggestion" | "question" | "other";

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; bg: string; text: string }
> = {
  bug: { label: "באג", bg: "bg-red-50", text: "text-red-700" },
  suggestion: { label: "הצעה", bg: "bg-emerald-50", text: "text-emerald-700" },
  question: { label: "שאלה", bg: "bg-blue-50", text: "text-blue-700" },
  other: { label: "אחר", bg: "bg-gray-100", text: "text-gray-700" },
};

type FeedbackRow = {
  id: string;
  category: Category;
  description: string;
  route: string;
  viewport: string | null;
  user_agent: string | null;
  is_read: boolean;
  created_at: string;
};

function formatDateHe(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FeedbackPage() {
  const { user, supabase } = await requireUser();
  if (!isSuperAdmin(user.email)) {
    redirect("/dashboard");
  }
  const { data } = await supabase
    .from("feedback")
    .select("id, category, description, route, viewport, user_agent, is_read, created_at")
    .order("created_at", { ascending: false });

  const rows: FeedbackRow[] = (data ?? []) as FeedbackRow[];
  const unreadCount = rows.filter((r) => !r.is_read).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-bold text-foreground">דיווחים</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
              {unreadCount} חדשים
            </span>
          )}
        </div>
        <p className="text-sm mt-1 text-muted-foreground">
          כל הדיווחים שנשלחו דרך כפתור &quot;דווח&quot;.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <Inbox className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-medium text-muted">עדיין אין דיווחים</p>
          <p className="mt-1 text-sm text-muted-foreground">
            כשמישהו ילחץ על כפתור &quot;דווח&quot;, ההודעה תופיע כאן.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div
            className="hidden md:block rounded-xl overflow-x-auto"
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <table className="w-full">
              <caption className="sr-only">רשימת דיווחים</caption>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th scope="col" className="w-4 px-4 py-3.5" aria-label="נקרא" />
                  <th scope="col" className="text-right px-4 py-3.5 text-sm font-medium text-muted w-24">תאריך</th>
                  <th scope="col" className="text-right px-4 py-3.5 text-sm font-medium text-muted w-24">קטגוריה</th>
                  <th scope="col" className="text-right px-4 py-3.5 text-sm font-medium text-muted w-56">דף</th>
                  <th scope="col" className="text-right px-4 py-3.5 text-sm font-medium text-muted">תיאור</th>
                  <th scope="col" className="text-right px-4 py-3.5 text-sm font-medium text-muted w-32">פעולה</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#e2e8f0" }}>
                {rows.map((row) => {
                  const cat = CATEGORY_CONFIG[row.category];
                  return (
                    <tr key={row.id} style={{ backgroundColor: row.is_read ? "#fff" : "#eff6ff" }}>
                      <td className="px-4 py-4">
                        {!row.is_read && (
                          <span aria-label="לא נקרא" className="inline-block h-2 w-2 rounded-full bg-primary" />
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                        {formatDateHe(row.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cat.bg} ${cat.text}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-muted font-mono" dir="ltr">
                        {row.route}
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">
                        <p className="line-clamp-2">{row.description}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {!row.is_read && <MarkReadButton id={row.id} />}
                          <DeleteFeedbackButton id={row.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row) => {
              const cat = CATEGORY_CONFIG[row.category];
              return (
                <div
                  key={row.id}
                  className="rounded-xl p-4 space-y-2 relative"
                  style={{
                    backgroundColor: row.is_read ? "#fff" : "#eff6ff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {!row.is_read && (
                    <span aria-label="לא נקרא" className="absolute top-3 left-3 h-2 w-2 rounded-full bg-primary" />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cat.bg} ${cat.text}`}>
                      {cat.label}
                    </span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {formatDateHe(row.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{row.description}</p>
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">{row.route}</p>
                  <div className="flex items-center gap-3 pt-2">
                    {!row.is_read && <MarkReadButton id={row.id} />}
                    <DeleteFeedbackButton id={row.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
