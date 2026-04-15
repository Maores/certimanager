import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

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

    // "עוד" trigger exists with correct aria (aria-controls is asserted
    // in the dedicated "aria-controls only points to existing sheet" suite).
    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn).toHaveAttribute("aria-expanded", "false");
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

describe("Sidebar — guest & overflow edge cases", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("hides /dashboard/import and /dashboard/candidates from pinned AND sheet when isGuest", () => {
    render(<Sidebar items={FULL_ITEMS} isGuest />);

    // Not in pinned row
    expect(document.querySelector('a[href="/dashboard/import"]')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/dashboard/candidates"]')).not.toBeInTheDocument();

    // Also not in sheet after opening
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));
    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    expect(sheet.querySelector('a[href="/dashboard/import"]')).not.toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/candidates"]')).not.toBeInTheDocument();

    // Sheet still contains the remaining 2 (cert-types, reports)
    expect(sheet.querySelector('a[href="/dashboard/cert-types"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/reports"]')).toBeInTheDocument();
  });

  it("hides the 'עוד' button when there are no overflow items", () => {
    const pinnedOnly: NavItem[] = FULL_ITEMS.filter((i) =>
      ["/dashboard", "/dashboard/employees", "/dashboard/certifications", "/dashboard/tasks"].includes(i.href)
    );
    render(<Sidebar items={pinnedOnly} />);

    expect(screen.queryByRole("button", { name: "עוד אפשרויות ניווט" })).not.toBeInTheDocument();
  });
});

describe("Sidebar — active highlight on 'עוד'", () => {
  it("renders 'עוד' with active styling when pathname is in overflow set", () => {
    mockPathname = "/dashboard/reports";
    render(<Sidebar items={FULL_ITEMS} />);

    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn.className).toContain("text-primary");
  });

  it("renders 'עוד' with inactive styling when pathname is in pinned set", () => {
    mockPathname = "/dashboard/employees";
    render(<Sidebar items={FULL_ITEMS} />);

    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn.className).toContain("text-muted-foreground");
  });
});

describe("Sidebar — sheet close triggers", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  function openSheet() {
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));
  }

  it("closes sheet on Escape key", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    openSheet();
    expect(screen.getByRole("dialog", { name: "ניווט משני" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עוד אפשרויות ניווט" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("closes sheet when scrim is clicked", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    openSheet();

    fireEvent.click(screen.getByTestId("mobile-more-scrim"));

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
  });

  it("closes sheet when a sheet item is tapped", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    openSheet();

    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    const reportsLink = sheet.querySelector('a[href="/dashboard/reports"]') as HTMLElement;
    fireEvent.click(reportsLink);

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
  });

  it("closes sheet when pathname changes", () => {
    const { rerender } = render(<Sidebar items={FULL_ITEMS} />);
    openSheet();
    expect(screen.getByRole("dialog", { name: "ניווט משני" })).toBeInTheDocument();

    // Simulate route change by flipping the mock and re-rendering
    mockPathname = "/dashboard/reports";
    rerender(<Sidebar items={FULL_ITEMS} />);

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
  });
});

describe("Sidebar — prefix-collision active match", () => {
  it("does NOT highlight 'עוד' when pathname prefix-collides with an overflow href (reports-archive)", () => {
    mockPathname = "/dashboard/reports-archive";
    render(<Sidebar items={FULL_ITEMS} />);

    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn.className).not.toContain("text-primary");
    expect(moreBtn.className).toContain("text-muted-foreground");
  });

  it("DOES highlight 'עוד' for legitimate sub-routes of an overflow href (/dashboard/reports/123)", () => {
    mockPathname = "/dashboard/reports/123";
    render(<Sidebar items={FULL_ITEMS} />);

    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn.className).toContain("text-primary");
  });
});

describe("Sidebar — aria-controls only points to existing sheet", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("omits aria-controls on 'עוד' while the sheet is closed", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn).not.toHaveAttribute("aria-controls");
  });

  it("sets aria-controls='mobile-more-sheet' once the sheet is open", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));
    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn).toHaveAttribute("aria-controls", "mobile-more-sheet");
    expect(document.getElementById("mobile-more-sheet")).toBeInTheDocument();
  });
});

describe("Sidebar — focus trap inside the sheet dialog", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("cycles focus from last sheet link back to first on Tab", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));

    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    const links = within(sheet).getAllByRole("link");
    const first = links[0] as HTMLElement;
    const last = links[links.length - 1] as HTMLElement;

    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(sheet, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("cycles focus from first sheet link back to last on Shift+Tab", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));

    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    const links = within(sheet).getAllByRole("link");
    const first = links[0] as HTMLElement;
    const last = links[links.length - 1] as HTMLElement;

    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(sheet, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
