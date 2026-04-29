import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  certs: [] as Array<{
    id: string;
    expiry_date: string | null;
    next_refresh_date: string | null;
    employee_id: string;
    cert_type_id: string;
    employees: { first_name: string; last_name: string } | null;
    cert_types: { name: string } | null;
  }>,
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: () => Promise.resolve("test-session"),
}));

vi.mock("@/lib/guest-store", () => ({
  guestGetEmployeeCount: () => 1,
  getGuestData: () => ({
    employees: [{ id: "e1", first_name: "טסט", last_name: "א", status: "פעיל" }],
    certTypes: [{ id: "ct1", name: "נת״ע" }],
    certifications: mocks.certs,
  }),
}));

import DashboardPage from "@/app/dashboard/page";

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("DashboardPage — alert banner integration", () => {
  beforeEach(() => {
    mocks.certs = [];
  });

  it("renders the alert banner when there are urgent certs", async () => {
    mocks.certs = [
      {
        id: "c1",
        expiry_date: ymd(-5),
        next_refresh_date: null,
        employee_id: "e1",
        cert_type_id: "ct1",
        employees: { first_name: "טסט", last_name: "א" },
        cert_types: { name: "נת״ע" },
      },
      {
        id: "c2",
        expiry_date: ymd(10),
        next_refresh_date: null,
        employee_id: "e1",
        cert_type_id: "ct1",
        employees: { first_name: "טסט", last_name: "ב" },
        cert_types: { name: "נת״ע" },
      },
    ];
    const element = await DashboardPage();
    render(element);
    const link = screen.getByRole("link", {
      name: /2 הסמכות דורשות תשומת לב/,
    });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe(
      "/dashboard/certifications?filter=attention"
    );
  });

  it("does not render the alert banner when all certs are valid", async () => {
    mocks.certs = [
      {
        id: "c1",
        expiry_date: ymd(120),
        next_refresh_date: null,
        employee_id: "e1",
        cert_type_id: "ct1",
        employees: { first_name: "טסט", last_name: "א" },
        cert_types: { name: "נת״ע" },
      },
    ];
    const element = await DashboardPage();
    render(element);
    expect(
      screen.queryByText(/הסמכות דורשות תשומת לב/)
    ).not.toBeInTheDocument();
  });

  it("renders the alert banner exactly once when there are urgent certs (no per-surface duplication)", async () => {
    mocks.certs = [
      {
        id: "c1",
        expiry_date: ymd(-5),
        next_refresh_date: null,
        employee_id: "e1",
        cert_type_id: "ct1",
        employees: { first_name: "טסט", last_name: "א" },
        cert_types: { name: "נת״ע" },
      },
    ];
    const element = await DashboardPage();
    render(element);
    const links = screen.getAllByRole("link", {
      name: /הסמכות דורשות תשומת לב/,
    });
    expect(links).toHaveLength(1);
  });
});

describe("DashboardPage — mobile/desktop split", () => {
  beforeEach(() => {
    mocks.certs = [];
  });

  it("renders the mobile hero grid (md:hidden) and the desktop stat grid (hidden md:block) in parallel", async () => {
    const element = await DashboardPage();
    const { container } = render(element);

    // Mobile hero grid is present in DOM.
    expect(
      container.querySelector('[data-testid="mobile-quick-actions-grid"]')
    ).toBeInTheDocument();

    // Desktop block wrapper is present and has hidden md:block.
    const desktopBlock = container.querySelector(
      '[data-testid="desktop-dashboard-block"]'
    );
    expect(desktopBlock).toBeInTheDocument();
    expect(desktopBlock?.className).toContain("hidden");
    expect(desktopBlock?.className).toContain("md:block");

    // Containment: stat-card grid is INSIDE the desktop block.
    expect(
      desktopBlock?.querySelector(".grid-cols-1")
    ).toBeInTheDocument();

    // Containment: mobile-quick-actions-grid is INSIDE the mobile wrapper.
    const mobileWrapper = container.querySelector(
      '[data-testid="mobile-dashboard-wrapper"]'
    );
    expect(
      mobileWrapper?.querySelector(
        '[data-testid="mobile-quick-actions-grid"]'
      )
    ).toBeInTheDocument();
  });

  it("wraps the mobile hero in a md:hidden container", async () => {
    const element = await DashboardPage();
    const { container } = render(element);
    const wrapper = container.querySelector('[data-testid="mobile-dashboard-wrapper"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.className).toContain("md:hidden");
  });
});
