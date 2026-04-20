import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn() }),
}));

const deleteFeedback = vi.fn();
vi.mock("@/app/dashboard/feedback/actions", () => ({
  deleteFeedback: (...args: unknown[]) => deleteFeedback(...args),
}));

import { DeleteFeedbackButton } from "@/app/dashboard/feedback/delete-feedback-button";

describe("DeleteFeedbackButton", () => {
  beforeEach(() => {
    routerRefresh.mockReset();
    deleteFeedback.mockReset();
    deleteFeedback.mockResolvedValue({ ok: true });
  });

  it("starts showing only the מחיקה trigger, not the confirm prompt", () => {
    render(<DeleteFeedbackButton id="fb-1" />);
    expect(screen.getByRole("button", { name: /מחיקה/ })).toBeInTheDocument();
    expect(screen.queryByText("בטוח?")).not.toBeInTheDocument();
  });

  it("shows 'בטוח?' and a מחק confirm after first click", () => {
    render(<DeleteFeedbackButton id="fb-1" />);
    fireEvent.click(screen.getByRole("button", { name: /מחיקה/ }));
    expect(screen.getByText("בטוח?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^מחק$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ביטול/ })).toBeInTheDocument();
  });

  it("ביטול restores the initial state without calling deleteFeedback", () => {
    render(<DeleteFeedbackButton id="fb-1" />);
    fireEvent.click(screen.getByRole("button", { name: /מחיקה/ }));
    fireEvent.click(screen.getByRole("button", { name: /ביטול/ }));
    expect(screen.queryByText("בטוח?")).not.toBeInTheDocument();
    expect(deleteFeedback).not.toHaveBeenCalled();
  });

  it("confirming calls deleteFeedback with the id and refreshes the router", async () => {
    render(<DeleteFeedbackButton id="fb-xyz" />);
    fireEvent.click(screen.getByRole("button", { name: /מחיקה/ }));
    fireEvent.click(screen.getByRole("button", { name: /^מחק$/ }));
    await waitFor(() => expect(deleteFeedback).toHaveBeenCalledWith("fb-xyz"));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });
});
