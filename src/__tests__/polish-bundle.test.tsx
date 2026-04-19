import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Polish bundle — three independent fixes surfaced in the Apr 19 triage.
// Grouped in one test file because they're each a single assertion and
// belong to the same PR.

// ---------- Fix 1: "לא ידוע" badge → amber (warning) ----------

const repoRoot = resolve(__dirname, "..", "..");
function source(relPath: string): string {
  return readFileSync(resolve(repoRoot, relPath), "utf8");
}

describe("polish — unknown-status badge uses amber variant", () => {
  it("certifications list page unknown entry uses bg-amber-*", () => {
    const src = source("src/app/dashboard/certifications/page.tsx");
    const match = src.match(/unknown:\s*{[^}]*}/);
    expect(match, "unknown config not found").toBeTruthy();
    expect(match![0]).toMatch(/bg-amber-/);
    expect(match![0]).toMatch(/text-amber-/);
    expect(match![0]).not.toMatch(/bg-gray-100/);
  });

  it("employee detail page unknown entry uses bg-amber-*", () => {
    const src = source("src/app/dashboard/employees/[id]/page.tsx");
    // statusConfig declares `unknown:` with label/bg/text/dot.
    const match = src.match(/unknown:\s*{[\s\S]*?}/);
    expect(match, "unknown config not found").toBeTruthy();
    expect(match![0]).toMatch(/bg:\s*"bg-amber-/);
    expect(match![0]).toMatch(/text:\s*"text-amber-/);
  });
});

// ---------- Fix 2: double-tap active bottom-nav tab → scrollTo(top) ----------

let mockPathname = "/dashboard/employees";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

import Sidebar, { type NavItem } from "@/components/layout/sidebar";

const ITEMS: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "dashboard" },
  { label: "עובדים", href: "/dashboard/employees", icon: "employees" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "certifications" },
  { label: "משימות", href: "/dashboard/tasks", icon: "tasks" },
];

describe("polish — active bottom-nav tab scrolls to top on re-tap", () => {
  beforeEach(() => {
    mockPathname = "/dashboard/employees";
  });

  it("tapping the currently-active mobile nav link calls window.scrollTo", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<Sidebar items={ITEMS} />);

    const navs = screen.getAllByRole("navigation", { name: "ניווט ראשי" });
    const mobileNav = navs[navs.length - 1];
    const activeLink = mobileNav.querySelector<HTMLAnchorElement>(
      'a[href="/dashboard/employees"]'
    );
    expect(activeLink, "active link not found").toBeTruthy();
    expect(activeLink!.getAttribute("aria-current")).toBe("page");

    fireEvent.click(activeLink!);

    expect(scrollSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0, behavior: "smooth" })
    );
    scrollSpy.mockRestore();
  });

  it("tapping an inactive mobile nav link does NOT call window.scrollTo", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<Sidebar items={ITEMS} />);

    const navs = screen.getAllByRole("navigation", { name: "ניווט ראשי" });
    const mobileNav = navs[navs.length - 1];
    const inactiveLink = mobileNav.querySelector<HTMLAnchorElement>(
      'a[href="/dashboard/certifications"]'
    );
    fireEvent.click(inactiveLink!);

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});

// ---------- Fix 3: employee list ID column clickable ----------

vi.mock("@/app/dashboard/employees/actions", () => ({
  deleteEmployees: vi.fn(),
  deleteEmployee: vi.fn(),
}));

vi.mock("../app/dashboard/employees/actions", () => ({
  deleteEmployees: vi.fn(),
  deleteEmployee: vi.fn(),
}));

vi.mock("next/navigation", async () => {
  // Re-export the active mockPathname so both suites can share the module.
  return {
    usePathname: () => mockPathname,
    useRouter: () => ({ refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  };
});

import { EmployeeListClient } from "@/components/employees/employee-list-client";
import type { Employee } from "@/types/database";

describe("polish — employee list ID column is a link", () => {
  it("desktop table wraps מספר זהות value in a Link to the employee detail page", () => {
    const employees: Employee[] = [
      {
        id: "emp-xyz",
        manager_id: "m",
        first_name: "דוד",
        last_name: "כהן",
        employee_number: "123456789",
        department: "HR",
        phone: "050",
        email: null,
        status: "פעיל",
        notes: null,
        created_at: null,
        updated_at: null,
      } as unknown as Employee,
    ];
    const { container } = render(<EmployeeListClient employees={employees} />);
    // Narrow to the desktop table (mobile card wraps the whole card in a
    // Link, so a naive query would false-pass).
    const desktopTable = container.querySelector("table");
    expect(desktopTable, "desktop table not found").toBeTruthy();
    const idCellLink = desktopTable!.querySelector<HTMLAnchorElement>(
      'a[href="/dashboard/employees/emp-xyz"]'
    );
    // Multiple anchors in the table row possible (name cell + ID cell).
    // Match specifically the one containing the ID value.
    const allLinks = Array.from(
      desktopTable!.querySelectorAll<HTMLAnchorElement>('a[href="/dashboard/employees/emp-xyz"]')
    );
    const linkedIdCell = allLinks.find((a) => a.textContent?.includes("123456789"));
    expect(
      linkedIdCell,
      "desktop ID cell 123456789 is not wrapped in a link to the detail page"
    ).toBeTruthy();
    void idCellLink;
  });
});
