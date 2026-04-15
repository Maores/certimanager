import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/navigation before importing the component.
// Use a mutable variable so individual tests can override the pathname.
let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// Import AFTER the mock.
import Sidebar, { type NavItem } from "@/components/layout/sidebar";

const FULL_ITEMS: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "dashboard" },
  { label: "עובדים", href: "/dashboard/employees", icon: "employees" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "certifications" },
  { label: "סוגי הסמכות", href: "/dashboard/cert-types", icon: "cert-types" },
  { label: "מועמדים לקורסים", href: "/dashboard/candidates", icon: "candidates" },
  { label: "משימות", href: "/dashboard/tasks", icon: "tasks" },
  { label: "ייבוא", href: "/dashboard/import", icon: "import" },
  { label: "דוחות", href: "/dashboard/reports", icon: "reports" },
];

describe("Sidebar — smoke", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders at least one nav landmark labelled 'ניווט ראשי'", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    // NOTE: current sidebar.tsx renders TWO such navs (desktop inner + mobile bottom).
    // We tolerate both and assert at least one exists. Task 2's tests select mobile
    // specifically via navs[navs.length - 1].
    const navs = screen.getAllByRole("navigation", { name: "ניווט ראשי" });
    expect(navs.length).toBeGreaterThan(0);
    expect(navs[0]).toBeInTheDocument();
  });
});
