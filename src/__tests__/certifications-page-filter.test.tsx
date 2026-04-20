import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: () => Promise.resolve("test-session"),
}));

vi.mock("@/lib/guest-store", () => ({
  guestGetCertTypes: () => [
    { id: "ct1", name: "נת״ע" },
    { id: "ct2", name: "כביש 6" },
  ],
  guestGetCertifications: () => [],
  getGuestData: () => ({
    employees: [{ department: "תפעול" }],
    certTypes: [],
    certifications: [],
  }),
}));

import CertificationsPage from "@/app/dashboard/certifications/page";

describe("CertificationsPage filter form", () => {
  it("renders exactly one input[name='type'] when typeFilter is set (regression: 2nd-click-returns-empty)", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({ type: "ct1" }),
    });
    const { container } = render(element);

    const typeInputs = container.querySelectorAll('[name="type"]');
    expect(typeInputs.length).toBe(1);
  });

  it("renders exactly one input[name='dept'] when deptFilter is set (same-class bug)", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({ dept: "תפעול" }),
    });
    const { container } = render(element);

    const deptInputs = container.querySelectorAll('[name="dept"]');
    expect(deptInputs.length).toBe(1);
  });

  it("renders exactly one input[name='type'] when typeFilter is empty", async () => {
    const element = await CertificationsPage({
      searchParams: Promise.resolve({}),
    });
    const { container } = render(element);

    const typeInputs = container.querySelectorAll('[name="type"]');
    expect(typeInputs.length).toBe(1);
  });
});
