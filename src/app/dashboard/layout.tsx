import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import Sidebar, { NavItem } from "@/components/layout/sidebar";

const navItems: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "📊" },
  { label: "עובדים", href: "/dashboard/employees", icon: "👥" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "📜" },
  { label: "סוגי הסמכות", href: "/dashboard/cert-types", icon: "🏷️" },
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
    <div dir="rtl" className="min-h-screen bg-gray-50 flex">
      {/* Sidebar (right side in RTL) */}
      <Sidebar items={navItems} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <h2 className="text-lg font-bold text-blue-600 md:hidden">
            CertiManager
          </h2>
          <div className="hidden md:block" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                יציאה
              </button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
