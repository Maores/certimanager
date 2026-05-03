import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MobileDashboardHero } from "@/components/dashboard/mobile-dashboard-hero";

const baseProps = {
  expiringList: [],
};

describe("MobileDashboardHero — auth user (4 tiles)", () => {
  it("renders all 4 tiles with correct labels and hrefs", () => {
    render(<MobileDashboardHero {...baseProps} isGuest={false} />);
    const grid = screen.getByTestId("mobile-quick-actions-grid");
    const links = within(grid).getAllByRole("link");
    expect(links).toHaveLength(4);

    const byLabel = (label: string) =>
      links.find((l) => l.textContent?.includes(label));

    expect(byLabel("הוסף הסמכה")?.getAttribute("href")).toBe(
      "/dashboard/certifications/new"
    );
    expect(byLabel("חפש עובד")?.getAttribute("href")).toBe(
      "/dashboard/employees"
    );
    expect(byLabel("הוסף עובד")?.getAttribute("href")).toBe(
      "/dashboard/employees/new"
    );
    expect(byLabel("ייבוא Excel")?.getAttribute("href")).toBe(
      "/dashboard/import"
    );
  });

  it("the primary tile (הוסף הסמכה) carries bg-primary class", () => {
    render(<MobileDashboardHero {...baseProps} isGuest={false} />);
    const grid = screen.getByTestId("mobile-quick-actions-grid");
    const primary = within(grid)
      .getAllByRole("link")
      .find((l) => l.textContent?.includes("הוסף הסמכה"));
    expect(primary?.className).toContain("bg-primary");
    expect(primary?.className).toContain("text-white");
  });
});

describe("MobileDashboardHero — guest user (3 tiles, asymmetric)", () => {
  it("hides ייבוא Excel and renders 3 tiles", () => {
    render(<MobileDashboardHero {...baseProps} isGuest={true} />);
    const grid = screen.getByTestId("mobile-quick-actions-grid");
    const links = within(grid).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(within(grid).queryByText("ייבוא Excel")).not.toBeInTheDocument();
  });

  it("the third tile (הוסף עובד) spans both columns", () => {
    render(<MobileDashboardHero {...baseProps} isGuest={true} />);
    const grid = screen.getByTestId("mobile-quick-actions-grid");
    const addEmployee = within(grid)
      .getAllByRole("link")
      .find((l) => l.textContent?.includes("הוסף עובד"));
    expect(addEmployee?.className).toContain("col-span-2");
  });
});

describe("MobileDashboardHero — expiring section", () => {
  it("renders the section heading", () => {
    render(<MobileDashboardHero {...baseProps} isGuest={false} />);
    expect(screen.getByText("פג תוקף בקרוב")).toBeInTheDocument();
  });

  it("renders the empty state when expiringList is empty", () => {
    render(<MobileDashboardHero {...baseProps} isGuest={false} />);
    expect(screen.getByText("הכל תקין")).toBeInTheDocument();
  });

  it("renders the expiring list when items are present", () => {
    render(
      <MobileDashboardHero
        expiringList={[
          {
            employee: "משה",
            cert: "רישיון",
            expires: "2026-04-28",
            status: "expired",
          },
        ]}
        isGuest={false}
      />
    );
    expect(screen.getByText("משה")).toBeInTheDocument();
    expect(screen.queryByText("הכל תקין")).not.toBeInTheDocument();
  });
});
