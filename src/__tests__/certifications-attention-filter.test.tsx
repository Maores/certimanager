import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  certs: [] as Array<{
    id: string;
    expiry_date: string | null;
    next_refresh_date: string | null;
    cert_type_id: string;
    image_url: string | null;
    image_filename: string | null;
    notes: string | null;
    issue_date: string | null;
    employees: { first_name: string; last_name: string; department: string } | null;
    cert_types: { id: string; name: string } | null;
  }>,
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: () => Promise.resolve("test-session"),
}));

vi.mock("@/lib/guest-store", () => ({
  guestGetCertTypes: () => [{ id: "ct1", name: "נת״ע" }],
  guestGetCertifications: () => mocks.certs,
  getGuestData: () => ({
    employees: [{ department: "תפעול" }],
    certTypes: [],
    certifications: mocks.certs,
  }),
}));

// CertificationsList is a client component that uses useRouter; mock it so
// the server-component page renders in vitest's jsdom environment.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/dashboard/certifications/actions", () => ({
  deleteCertification: vi.fn(),
  deleteCertifications: vi.fn(),
  getSignedUrl: vi.fn(),
}));

import CertificationsPage from "@/app/dashboard/certifications/page";

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildCert(id: string, expiryOffsetDays: number, certName: string) {
  return {
    id,
    issue_date: null,
    expiry_date: ymd(expiryOffsetDays),
    next_refresh_date: null,
    image_url: null,
    image_filename: null,
    notes: null,
    cert_type_id: "ct1",
    employees: { first_name: "טסט", last_name: id, department: "תפעול" },
    cert_types: { id: "ct1", name: certName },
  };
}

describe("CertificationsPage — ?filter=attention", () => {
  beforeEach(() => {
    mocks.certs = [
      buildCert("expired-1", -10, "א"),    // expired
      buildCert("soon-1", 5, "ב"),          // expiring_soon
      buildCert("valid-1", 100, "ג"),       // valid
    ];
  });

  it("includes both expired and expiring_soon rows under filter=attention", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({ filter: "attention" }),
    });
    const { container } = render(element);
    const html = container.textContent || "";
    expect(html).toContain("טסט expired-1");
    expect(html).toContain("טסט soon-1");
  });

  it("excludes valid rows under filter=attention", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({ filter: "attention" }),
    });
    const { container } = render(element);
    const html = container.textContent || "";
    expect(html).not.toContain("טסט valid-1");
  });

  it("renders the attention heading when filter=attention is active", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({ filter: "attention" }),
    });
    const { container } = render(element);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("הסמכות שדורשות תשומת לב");
  });

  it("renders the default heading when filter is not attention", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({}),
    });
    const { container } = render(element);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("הסמכות");
  });

  it("hides the tab strip when filter=attention is active", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({ filter: "attention" }),
    });
    const { container } = render(element);
    // The four standard tabs (all / valid / expiring_soon / expired) render as
    // <Link> with hrefs like /dashboard/certifications?filter=valid. When
    // ?filter=attention is active, none of these should appear in the DOM
    // because there is no "you are here" cell to highlight.
    const standardTabs = container.querySelectorAll(
      'a[href*="filter=all"], a[href*="filter=valid"], a[href*="filter=expiring_soon"], a[href*="filter=expired"]'
    );
    expect(standardTabs.length).toBe(0);
  });

  it("renders the tab strip when filter is not attention", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({}),
    });
    const { container } = render(element);
    const standardTabs = container.querySelectorAll(
      'a[href*="filter=all"], a[href*="filter=valid"], a[href*="filter=expiring_soon"], a[href*="filter=expired"]'
    );
    expect(standardTabs.length).toBeGreaterThanOrEqual(4);
  });
});
