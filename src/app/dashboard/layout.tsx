import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import Sidebar, { NavItem } from "@/components/layout/sidebar";
import { LogOut } from "lucide-react";

const navItems: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "dashboard" },
  { label: "עובדים", href: "/dashboard/employees", icon: "employees" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "certifications" },
  { label: "סוגי הסמכות", href: "/dashboard/cert-types", icon: "cert-types" },
  { label: "ייבוא", href: "/dashboard/import", icon: "import" },
  { label: "דוחות", href: "/dashboard/reports", icon: "reports" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background flex">
      <Sidebar items={navItems} />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <h2 className="text-lg font-bold text-primary md:hidden tracking-tight">
            CertiManager
          </h2>
          <div className="hidden md:block" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted hidden sm:inline">
              {user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger font-medium px-3 py-1.5 rounded-lg hover:bg-danger-light transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">יציאה</span>
              </button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 pb-24 md:pb-6 overflow-x-hidden animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
