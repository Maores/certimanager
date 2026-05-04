import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { CandidatesTabs } from "@/components/candidates/candidates-tabs";

describe("CandidatesTabs", () => {
  it("renders both tabs with their counts", () => {
    render(<CandidatesTabs activeTab="leads" leadsCount={23} candidatesCount={47} />);
    expect(screen.getByRole("tab", { name: /לידים\s*\(23\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /מועמדים\s*\(47\)/ })).toBeInTheDocument();
  });

  it("marks the active tab via aria-selected", () => {
    render(<CandidatesTabs activeTab="candidates" leadsCount={0} candidatesCount={5} />);
    const candTab = screen.getByRole("tab", { name: /מועמדים/ });
    const leadsTab = screen.getByRole("tab", { name: /לידים/ });
    expect(candTab).toHaveAttribute("aria-selected", "true");
    expect(leadsTab).toHaveAttribute("aria-selected", "false");
  });

  it("links each tab to the correct ?tab= URL", () => {
    render(<CandidatesTabs activeTab="leads" leadsCount={0} candidatesCount={0} />);
    expect(screen.getByRole("tab", { name: /לידים/ })).toHaveAttribute(
      "href",
      "/dashboard/candidates?tab=leads"
    );
    expect(screen.getByRole("tab", { name: /מועמדים/ })).toHaveAttribute(
      "href",
      "/dashboard/candidates?tab=candidates"
    );
  });
});
