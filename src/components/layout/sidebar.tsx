"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Award,
  Tag,
  FileUp,
  BarChart3,
  ClipboardList,
  GraduationCap,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const PINNED_MOBILE_HREFS = [
  "/dashboard",
  "/dashboard/employees",
  "/dashboard/certifications",
  "/dashboard/tasks",
];

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  items: NavItem[];
  isGuest?: boolean;
}

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  employees: Users,
  certifications: Award,
  "cert-types": Tag,
  import: FileUp,
  reports: BarChart3,
  candidates: GraduationCap,
  tasks: ClipboardList,
};

function getIcon(href: string): LucideIcon {
  if (href === "/dashboard") return LayoutDashboard;
  const segment = href.split("/").pop() || "";
  return iconMap[segment] || LayoutDashboard;
}

function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ items, isGuest }: SidebarProps) {
  const pathname = usePathname();
  const filteredItems = isGuest
    ? items.filter(item => !["/dashboard/import", "/dashboard/candidates"].includes(item.href))
    : items;

  const pinnedItems = filteredItems.filter((i) => PINNED_MOBILE_HREFS.includes(i.href));
  const overflowItems = filteredItems.filter((i) => !PINNED_MOBILE_HREFS.includes(i.href));
  const hasOverflow = overflowItems.length > 0;
  const overflowActive = overflowItems.some((i) => isActiveHref(pathname, i.href));

  const [sheetOpen, setSheetOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Escape key + focus management while open
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Focus the dialog container (tabIndex=-1) rather than the first link
    // so we satisfy aria-modal without painting a :focus-visible ring on a
    // non-active overflow item. Tab from the dialog moves naturally to the
    // first focusable link.
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Return focus to trigger when closing (skip on initial mount)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (!sheetOpen) moreBtnRef.current?.focus({ preventScroll: true });
  }, [sheetOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside aria-label="תפריט ניווט" className="hidden md:flex flex-col w-64 bg-white border-l border-border">
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
        <nav aria-label="ניווט ראשי" className="flex-1 p-3 space-y-0.5">
          {filteredItems.map((item) => {
            const isActive = isActiveHref(pathname, item.href);
            const Icon = getIcon(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
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
      <nav
        aria-label="ניווט ראשי"
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-bottom"
      >
        <div className="flex items-center h-16 px-2">
          {pinnedItems.map((item) => {
            const isActive = isActiveHref(pathname, item.href);
            const Icon = getIcon(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={
                  isActive
                    ? () => window.scrollTo({ top: 0, behavior: "smooth" })
                    : undefined
                }
                className={`
                  flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1.5
                  transition-colors duration-150
                  ${isActive ? "text-primary" : "text-muted-foreground"}
                `}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span
                  className={`text-[10px] truncate leading-none max-w-full px-0.5 ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {hasOverflow && (
            <button
              ref={moreBtnRef}
              type="button"
              aria-label="עוד אפשרויות ניווט"
              aria-expanded={sheetOpen}
              aria-controls={sheetOpen ? "mobile-more-sheet" : undefined}
              onClick={() => setSheetOpen((v) => !v)}
              className={`
                flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1.5
                transition-colors duration-150
                ${overflowActive || sheetOpen ? "text-primary" : "text-muted-foreground"}
              `}
            >
              <MoreHorizontal
                className="h-5 w-5"
                strokeWidth={overflowActive || sheetOpen ? 2.25 : 1.75}
              />
              <span
                className={`text-[10px] truncate leading-none max-w-full px-0.5 ${
                  overflowActive || sheetOpen ? "font-semibold" : "font-medium"
                }`}
              >
                עוד
              </span>
            </button>
          )}
        </div>
      </nav>

      {hasOverflow && sheetOpen && (
        <>
          <div
            data-testid="mobile-more-scrim"
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 bottom-16 bg-black/40 z-40 md:hidden animate-fade-in"
          />
          <div
            ref={dialogRef}
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="ניווט משני"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const focusables = e.currentTarget.querySelectorAll<HTMLElement>("a[href]");
              if (focusables.length === 0) return;
              const first = focusables[0];
              const last = focusables[focusables.length - 1];
              const active = document.activeElement;
              // Shift+Tab from first link — or from the dialog itself when it
              // holds initial focus — cycles to the last link.
              if (e.shiftKey && (active === first || active === e.currentTarget)) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
              }
            }}
            className="fixed bottom-16 inset-x-0 z-[60] md:hidden bg-white border-t border-border rounded-t-2xl shadow-lg pb-[env(safe-area-inset-bottom)] animate-fade-in focus:outline-none"
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="grid grid-cols-4 gap-1 p-3" dir="rtl">
              {overflowItems.map((item) => {
                const isActive = isActiveHref(pathname, item.href);
                const Icon = getIcon(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setSheetOpen(false)}
                    className={`
                      flex flex-col items-center justify-center gap-1 min-h-16 rounded-lg py-2 px-1
                      transition-colors
                      ${isActive ? "text-primary bg-primary-light" : "text-muted-foreground hover:bg-gray-50"}
                    `}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                    <span
                      className={`text-[10px] leading-tight text-center ${
                        isActive ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
