// src/__tests__/feedback-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
const fromSpy = vi.fn((_table: string) => ({
  insert: insertSpy,
  update: (patch: unknown) => {
    updateSpy(patch);
    return { eq: eqSpy };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromSpy })),
}));

const requireUserSpy = vi.fn();
vi.mock("@/lib/supabase/auth", () => ({
  requireUser: requireUserSpy,
}));

beforeEach(() => {
  insertSpy.mockReset();
  insertSpy.mockResolvedValue({ error: null });
  updateSpy.mockReset();
  eqSpy.mockReset();
  eqSpy.mockResolvedValue({ error: null });
  fromSpy.mockClear();
  requireUserSpy.mockReset();
  requireUserSpy.mockResolvedValue({
    user: { id: "user-1", email: "a@b.co" },
    supabase: { from: fromSpy },
  });
  vi.resetModules();
});

describe("submitFeedback", () => {
  it("inserts a feedback row with manager_id from requireUser and the form fields", async () => {
    const { submitFeedback } = await import("@/app/dashboard/feedback/actions");

    const fd = new FormData();
    fd.set("category", "bug");
    fd.set("description", "something broke");
    fd.set("route", "/dashboard/employees");
    fd.set("viewport", "375x812");
    fd.set("user_agent", "jsdom");

    const result = await submitFeedback(fd);

    expect(result).toEqual({ ok: true });
    expect(fromSpy).toHaveBeenCalledWith("feedback");
    expect(insertSpy).toHaveBeenCalledWith({
      manager_id: "user-1",
      category: "bug",
      description: "something broke",
      route: "/dashboard/employees",
      viewport: "375x812",
      user_agent: "jsdom",
    });
  });

  it("returns an error message when Supabase insert fails", async () => {
    insertSpy.mockResolvedValue({ error: { message: "check constraint failed" } });
    const { submitFeedback } = await import("@/app/dashboard/feedback/actions");
    const fd = new FormData();
    fd.set("category", "bug");
    fd.set("description", "x");
    fd.set("route", "/dashboard");
    const result = await submitFeedback(fd);
    expect(result).toEqual({ error: "check constraint failed" });
  });

  it("rejects empty description before hitting Supabase", async () => {
    const { submitFeedback } = await import("@/app/dashboard/feedback/actions");
    const fd = new FormData();
    fd.set("category", "bug");
    fd.set("description", "");
    fd.set("route", "/dashboard");
    const result = await submitFeedback(fd);
    expect(result).toEqual({ error: expect.stringContaining("תיאור") });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid category", async () => {
    const { submitFeedback } = await import("@/app/dashboard/feedback/actions");
    const fd = new FormData();
    fd.set("category", "hack");
    fd.set("description", "x");
    fd.set("route", "/dashboard");
    const result = await submitFeedback(fd);
    expect(result).toEqual({ error: expect.any(String) });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("markFeedbackRead", () => {
  it("updates is_read=true and scopes by id", async () => {
    const { markFeedbackRead } = await import("@/app/dashboard/feedback/actions");
    const result = await markFeedbackRead("fb-xyz");
    expect(result).toEqual({ ok: true });
    expect(fromSpy).toHaveBeenCalledWith("feedback");
    expect(updateSpy).toHaveBeenCalledWith({ is_read: true });
    expect(eqSpy).toHaveBeenCalledWith("id", "fb-xyz");
  });

  it("returns an error when Supabase update fails", async () => {
    eqSpy.mockResolvedValue({ error: { message: "denied" } });
    const { markFeedbackRead } = await import("@/app/dashboard/feedback/actions");
    const result = await markFeedbackRead("fb-xyz");
    expect(result).toEqual({ error: "denied" });
  });

  it("rejects empty id", async () => {
    const { markFeedbackRead } = await import("@/app/dashboard/feedback/actions");
    const result = await markFeedbackRead("");
    expect(result).toEqual({ error: expect.any(String) });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
