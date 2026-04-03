"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  items: NavItem[];
}

export default function Sidebar({ items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-l border-gray-200">
        {/* Logo area */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">CertiManager</h1>
        </div>

        {/* Navigation links */}
        <nav className="p-4 space-y-1">
          {items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-colors duration-200
                  ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border-r-4 border-blue-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 md:hidden safe-area-bottom">
        <div className="flex justify-around items-center h-16 px-1">
          {items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg
                  transition-colors duration-200
                  ${isActive ? "text-blue-600" : "text-gray-400"}
                `}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span
                  className={`text-[10px] truncate ${isActive ? "font-semibold" : "font-medium"}`}
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
