import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteSpy = vi.fn();
const eqFirstSpy = vi.fn();
const eqSecondSpy = vi.fn();

// Chain: .delete().eq("id", id).eq("manager_id", userId)
const fromSpy = vi.fn((_table: string) => ({
  delete: () => {
    deleteSpy();
    return {
      eq: (col: string, val: string) => {
        eqFirstSpy(col, val);
        return { eq: eqSecondSpy };
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: fromSpy,
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect: ${path}`);
  }),
}));

beforeEach(() => {
  deleteSpy.mockReset();
  eqFirstSpy.mockReset();
  eqSecondSpy.mockReset();
  eqSecondSpy.mockResolvedValue({ error: null });
  fromSpy.mockClear();
  vi.resetModules();
});

describe("deleteCandidates", () => {
  it("deletes each id scoped by manager_id and returns the count", async () => {
    const { deleteCandidates } = await import("@/app/dashboard/candidates/actions");
    const result = await deleteCandidates(["c1", "c2", "c3"]);

    expect(result).toEqual({ deleted: 3, errors: [] });
    expect(fromSpy).toHaveBeenCalledWith("course_candidates");
    expect(deleteSpy).toHaveBeenCalledTimes(3);
    expect(eqFirstSpy).toHaveBeenNthCalledWith(1, "id", "c1");
    expect(eqFirstSpy).toHaveBeenNthCalledWith(2, "id", "c2");
    expect(eqFirstSpy).toHaveBeenNthCalledWith(3, "id", "c3");
    // Second .eq scopes by manager_id = user.id
    expect(eqSecondSpy).toHaveBeenCalledWith("manager_id", "user-1");
  });

  it("records partial failures and keeps going", async () => {
    // First two succeed, third fails
    eqSecondSpy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } });

    const { deleteCandidates } = await import("@/app/dashboard/candidates/actions");
    const result = await deleteCandidates(["c1", "c2", "c3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("c3");
  });

  it("returns zero deleted on empty array without hitting Supabase", async () => {
    const { deleteCandidates } = await import("@/app/dashboard/candidates/actions");
    const result = await deleteCandidates([]);

    expect(result).toEqual({ deleted: 0, errors: [] });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
