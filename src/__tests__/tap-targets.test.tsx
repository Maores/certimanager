import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Journey 02 × sarah-mobile (2026-04-19) surfaced four tap-target findings at
// 375×812: all the primary mobile controls were below the 44px touch-target
// baseline. These tests pin down the minimum class contract so the fix can't
// silently regress.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock server action module to avoid the import chain.
vi.mock("@/app/dashboard/employees/actions", () => ({
  deleteEmployees: vi.fn(),
  deleteEmployee: vi.fn(),
}));

vi.mock("../app/dashboard/employees/actions", () => ({
  deleteEmployees: vi.fn(),
  deleteEmployee: vi.fn(),
}));

import { DeleteEmployeeButton } from "@/app/dashboard/employees/[id]/delete-button";
import { EmployeeListClient } from "@/components/employees/employee-list-client";
import type { Employee } from "@/types/database";

function hasTapTargetClasses(el: Element | null): boolean {
  if (!el) return false;
  const cls = el.className;
  return cls.includes("min-h-[44px]") && cls.includes("min-w-[44px]");
}

function hasTapHeight(el: Element | null): boolean {
  if (!el) return false;
  return el.className.includes("min-h-[44px]");
}

describe("Mobile tap targets — components", () => {
  it("employee-detail DeleteEmployeeButton trigger has min-h-[44px]", () => {
    render(<DeleteEmployeeButton employeeId="abc" />);
    const btn = screen.getByRole("button", { name: "מחק" });
    expect(hasTapHeight(btn)).toBe(true);
  });

  it("employee-list mobile card selector has 44×44 tap area", () => {
    const employees: Employee[] = [
      {
        id: "id-1",
        manager_id: "m",
        first_name: "דוד",
        last_name: "כהן",
        employee_number: "123",
        department: "HR",
        phone: "050-0000000",
        email: null,
        status: "פעיל",
        notes: null,
        created_at: null,
        updated_at: null,
      } as unknown as Employee,
    ];
    render(<EmployeeListClient employees={employees} />);
    const checkboxes = screen.getAllByRole("checkbox", { name: /בחר דוד כהן/ });
    // Two render contexts (desktop + mobile). The mobile one is the second
    // checkbox in DOM order (the desktop card is hidden via `sm:hidden`).
    const mobile = checkboxes[checkboxes.length - 1];
    expect(hasTapTargetClasses(mobile)).toBe(true);
  });
});

// The remaining three findings live in server components that can't be
// rendered through RTL without heavy Supabase-auth mocking. Pin the class
// contract by source-level inspection — still a real regression guard because
// the string lives at a known location in a known file.

const repoRoot = resolve(__dirname, "..", "..");
function source(relPath: string): string {
  return readFileSync(resolve(repoRoot, relPath), "utf8");
}

describe("Mobile tap targets — server component source", () => {
  it("employee detail page ערוך link includes min-h-[44px]", () => {
    const src = source("src/app/dashboard/employees/[id]/page.tsx");
    // The edit link renders the word ערוך after a Pencil icon.
    // Grab the enclosing <Link> block ending in ערוך and assert the class.
    const match = src.match(/<Link[\s\S]*?ערוך[\s\S]*?<\/Link>/);
    expect(match, "ערוך link not found").toBeTruthy();
    expect(match![0]).toMatch(/min-h-\[44px\]/);
  });

  it("certifications mobile cert card עריכה link and מחיקה button include min-h-[44px]", () => {
    // Mobile card JSX moved to the CertificationsList client component as
    // part of the bulk-delete refactor. Scan the new location.
    const src = source("src/components/certifications/certifications-list.tsx");
    // Narrow to the mobile cards block.
    const mobileIdx = src.indexOf("{/* Mobile cards */}");
    expect(mobileIdx).toBeGreaterThan(-1);
    const mobileBlock = src.slice(mobileIdx);
    // The עריכה link.
    const editMatch = mobileBlock.match(/<Link[\s\S]*?עריכה[\s\S]*?<\/Link>/);
    expect(editMatch, "mobile עריכה link not found").toBeTruthy();
    expect(editMatch![0]).toMatch(/min-h-\[44px\]/);
    // The מחיקה submit button.
    const delMatch = mobileBlock.match(/<button[\s\S]*?מחיקה[\s\S]*?<\/button>/);
    expect(delMatch, "mobile מחיקה button not found").toBeTruthy();
    expect(delMatch![0]).toMatch(/min-h-\[44px\]/);
  });

  it("global logout יציאה button includes min-h-[44px]", () => {
    const src = source("src/app/dashboard/layout.tsx");
    const match = src.match(/<button[\s\S]*?aria-label="יציאה"[\s\S]*?<\/button>/);
    expect(match, "logout button not found").toBeTruthy();
    expect(match![0]).toMatch(/min-h-\[44px\]/);
  });
});
