// src/__tests__/report-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const submitSpy = vi.fn();
vi.mock("@/app/dashboard/feedback/actions", () => ({
  submitFeedback: submitSpy,
}));

import { ReportButton } from "@/components/feedback/report-modal";

beforeEach(() => {
  submitSpy.mockReset();
  submitSpy.mockResolvedValue({ ok: true });
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 812, configurable: true });
  Object.defineProperty(window, "navigator", {
    value: { userAgent: "test-ua" },
    configurable: true,
  });
  Object.defineProperty(window, "location", {
    value: { pathname: "/dashboard/employees", search: "?q=x" },
    configurable: true,
  });
});

describe("ReportButton", () => {
  it("opens the popover when clicked", () => {
    render(<ReportButton />);
    const btn = screen.getByRole("button", { name: "דווח על בעיה" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "דווח על בעיה" })).toBeInTheDocument();
  });

  it("submits with auto-captured context", async () => {
    render(<ReportButton />);
    fireEvent.click(screen.getByRole("button", { name: "דווח על בעיה" }));

    const textarea = screen.getByLabelText("תיאור");
    fireEvent.change(textarea, { target: { value: "נתקע בטעינה" } });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() => expect(submitSpy).toHaveBeenCalled());
    const fd = submitSpy.mock.calls[0][0] as FormData;
    expect(fd.get("category")).toBe("bug");
    expect(fd.get("description")).toBe("נתקע בטעינה");
    expect(fd.get("route")).toBe("/dashboard/employees?q=x");
    expect(fd.get("viewport")).toBe("375x812");
    expect(fd.get("user_agent")).toBe("test-ua");
  });

  it("surfaces error message and keeps popover open on failure", async () => {
    submitSpy.mockResolvedValue({ error: "RLS denied" });
    render(<ReportButton />);
    fireEvent.click(screen.getByRole("button", { name: "דווח על בעיה" }));
    const textarea = screen.getByLabelText("תיאור");
    fireEvent.change(textarea, { target: { value: "x" } });
    fireEvent.submit(textarea.closest("form")!);
    await waitFor(() => expect(screen.getByText("RLS denied")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "דווח על בעיה" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });
});
