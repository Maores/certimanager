import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { isGuestSession } from "@/lib/guest-session";
import Sidebar, { NavItem } from "@/components/layout/sidebar";
import { LogOut } from "lucide-react";

const navItems: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "dashboard" },
  { label: "עובדים", href: "/dashboard/employees", icon: "employees" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "certifications" },
  { label: "סוגי הסמכות", href: "/dashboard/cert-types", icon: "cert-types" },
  { label: "מועמדים לקורסים", href: "/dashboard/candidates", icon: "candidates" },
  { label: "משימות", href: "/dashboard/tasks", icon: "tasks" },
  { label: "ייבוא", href: "/dashboard/import", icon: "import" },
  { label: "דוחות", href: "/dashboard/reports", icon: "reports" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const guest = await isGuestSession();
  let userEmail = "אורח";

  if (!guest) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
    userEmail = user.email || "משתמש";
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <Sidebar items={navItems} isGuest={guest} />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header aria-label="סרגל עליון" className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <h2 className="text-lg font-bold text-primary md:hidden tracking-tight">
            CertiManager
          </h2>
          <div className="hidden md:block" />

          <div className="flex items-center gap-3">
            {guest && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full hidden sm:inline">
                מצב אורח
              </span>
            )}
            <span className="text-sm text-muted hidden sm:inline">
              {userEmail}
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="יציאה"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger font-medium px-3 py-1.5 rounded-lg hover:bg-danger-light transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">יציאה</span>
              </button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main aria-label="תוכן ראשי" className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 overflow-x-hidden animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
