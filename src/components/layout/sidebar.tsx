"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Award,
  Tag,
  FileUp,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  items: NavItem[];
}

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  employees: Users,
  certifications: Award,
  "cert-types": Tag,
  import: FileUp,
  reports: BarChart3,
};

function getIcon(href: string): LucideIcon {
  if (href === "/dashboard") return LayoutDashboard;
  const segment = href.split("/").pop() || "";
  return iconMap[segment] || LayoutDashboard;
}

export default function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-l border-border">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Award className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            CertiManager
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = getIcon(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${
                    isActive
                      ? "bg-primary-light text-primary shadow-[var(--shadow-xs)]"
                      : "text-muted hover:bg-gray-50 hover:text-foreground"
                  }
                `}
              >
                <Icon
                  className={`h-[18px] w-[18px] flex-shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 text-xs text-muted-foreground">
            v1.0 &middot; ניהול הסמכות
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-bottom">
        <div className="flex items-center h-16 px-2">
          {items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = getIcon(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1.5
                  transition-colors duration-150
                  ${isActive ? "text-primary" : "text-muted-foreground"}
                `}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span
                  className={`text-[9px] truncate leading-none max-w-full px-0.5 ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
