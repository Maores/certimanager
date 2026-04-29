import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileExpiringList } from "@/components/dashboard/mobile-expiring-list";

describe("MobileExpiringList", () => {
  it("renders the empty-state card when the list is empty", () => {
    render(<MobileExpiringList expiringList={[]} />);
    expect(screen.getByText("הכל תקין")).toBeInTheDocument();
    expect(
      screen.getByText("אין הסמכות שפג תוקפן או עומדות לפוג")
    ).toBeInTheDocument();
  });

  it("renders one row per item with employee name, cert name, and date", () => {
    render(
      <MobileExpiringList
        expiringList={[
          {
            employee: "משה כהן",
            cert: "רישיון נהיגה",
            expires: "2026-04-28",
            status: "expired",
          },
          {
            employee: "דוד לוי",
            cert: "בטיחות בעבודה",
            expires: "2026-05-02",
            status: "expiring_soon",
          },
        ]}
      />
    );
    expect(screen.getByText("משה כהן")).toBeInTheDocument();
    expect(screen.getByText("דוד לוי")).toBeInTheDocument();
    expect(screen.getByText(/רישיון נהיגה/)).toBeInTheDocument();
    expect(screen.getByText(/בטיחות בעבודה/)).toBeInTheDocument();
    // Confirm formatDateHe rendered the date — locale-variant tolerant.
    const dateMatches = screen.getAllByText(/2026/);
    expect(dateMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'פג תוקף' pill for expired rows and 'פג בקרוב' pill for expiring_soon rows", () => {
    render(
      <MobileExpiringList
        expiringList={[
          {
            employee: "א",
            cert: "x",
            expires: "2026-01-01",
            status: "expired",
          },
          {
            employee: "ב",
            cert: "y",
            expires: "2026-12-01",
            status: "expiring_soon",
          },
        ]}
      />
    );
    expect(screen.getByText("פג תוקף")).toBeInTheDocument();
    expect(screen.getByText("פג בקרוב")).toBeInTheDocument();
  });
});
