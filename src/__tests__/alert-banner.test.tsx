import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertBanner } from "@/components/dashboard/alert-banner";

describe("AlertBanner", () => {
  it("returns null when attentionCount === 0", () => {
    const { container } = render(
      <AlertBanner attentionCount={0} expiredCount={0} expiringSoonCount={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows both halves of the subtitle when both counts are positive", () => {
    render(
      <AlertBanner attentionCount={12} expiredCount={3} expiringSoonCount={9} />
    );
    expect(screen.getByText("12 הסמכות דורשות תשומת לב")).toBeInTheDocument();
    expect(screen.getByText("3 פגות תוקף · 9 פגות בקרוב")).toBeInTheDocument();
  });

  it("shows only the expiring half when expiredCount === 0", () => {
    render(
      <AlertBanner attentionCount={9} expiredCount={0} expiringSoonCount={9} />
    );
    expect(screen.getByText("9 פגות בקרוב")).toBeInTheDocument();
    expect(screen.queryByText(/פגות תוקף/)).not.toBeInTheDocument();
  });

  it("shows only the expired half when expiringSoonCount === 0", () => {
    render(
      <AlertBanner attentionCount={3} expiredCount={3} expiringSoonCount={0} />
    );
    expect(screen.getByText("3 פגות תוקף")).toBeInTheDocument();
    expect(screen.queryByText(/פגות בקרוב/)).not.toBeInTheDocument();
  });

  it("exposes a full-count aria-label", () => {
    render(
      <AlertBanner attentionCount={12} expiredCount={3} expiringSoonCount={9} />
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toBe(
      "12 הסמכות דורשות תשומת לב, 3 פגות תוקף · 9 פגות בקרוב, לחץ לצפייה ברשימה"
    );
  });

  it("renders a real <a> with href to the attention filter URL", () => {
    render(
      <AlertBanner attentionCount={1} expiredCount={1} expiringSoonCount={0} />
    );
    const link = screen.getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe(
      "/dashboard/certifications?filter=attention"
    );
  });

  it("does not render an empty subtitle paragraph when both halves are zero", () => {
    const { container } = render(
      <AlertBanner attentionCount={5} expiredCount={0} expiringSoonCount={0} />
    );
    const paragraphs = container.querySelectorAll("p");
    // Only the title paragraph should render. No empty subtitle paragraph.
    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0]?.textContent).toBe("5 הסמכות דורשות תשומת לב");
  });

  it("uses a comma-clean aria-label when the subtitle is empty", () => {
    render(
      <AlertBanner attentionCount={5} expiredCount={0} expiringSoonCount={0} />
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toBe(
      "5 הסמכות דורשות תשומת לב, לחץ לצפייה ברשימה"
    );
  });
});
