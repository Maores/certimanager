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

describe("Sidebar — mobile nav: 4 pinned + עוד", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders 4 pinned links plus an 'עוד' button on mobile", () => {
    render(<Sidebar items={FULL_ITEMS} />);

    // The mobile nav is the second navigation landmark (first is desktop).
    const navs = screen.getAllByRole("navigation", { name: "ניווט ראשי" });
    const mobileNav = navs[navs.length - 1]; // last one in DOM is mobile

    // 4 pinned: dashboard, employees, certifications, tasks
    expect(mobileNav.querySelectorAll('a[href="/dashboard"]').length).toBeGreaterThan(0);
    expect(mobileNav.querySelector('a[href="/dashboard/employees"]')).toBeInTheDocument();
    expect(mobileNav.querySelector('a[href="/dashboard/certifications"]')).toBeInTheDocument();
    expect(mobileNav.querySelector('a[href="/dashboard/tasks"]')).toBeInTheDocument();

    // "עוד" trigger exists with correct aria
    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn).toHaveAttribute("aria-expanded", "false");
    expect(moreBtn).toHaveAttribute("aria-controls", "mobile-more-sheet");
  });

  it("opens the sheet and exposes the 4 overflow items when 'עוד' is clicked", () => {
    render(<Sidebar items={FULL_ITEMS} />);

    // Before click: sheet dialog not present
    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));

    // After click: dialog present, aria-expanded flipped, all 4 overflow hrefs reachable
    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עוד אפשרויות ניווט" })).toHaveAttribute("aria-expanded", "true");

    expect(sheet.querySelector('a[href="/dashboard/cert-types"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/candidates"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/import"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/reports"]')).toBeInTheDocument();
  });
});
