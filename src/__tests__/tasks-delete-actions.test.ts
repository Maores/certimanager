import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ------------------------------------------------------------
const selectSingleSpy = vi.fn();
const deleteEqSpy = vi.fn();
const getGuestSessionIdSpy = vi.fn();

const fromSpy = vi.fn((_table: string) => ({
  select: (_cols: string) => ({
    eq: (_col: string, _val: string) => ({
      single: selectSingleSpy,
    }),
  }),
  delete: () => ({
    eq: (col: string, val: string) => deleteEqSpy(col, val),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: fromSpy,
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  })),
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: (...args: unknown[]) => getGuestSessionIdSpy(...args),
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
  selectSingleSpy.mockReset();
  deleteEqSpy.mockReset();
  getGuestSessionIdSpy.mockReset();
  getGuestSessionIdSpy.mockResolvedValue(null);
  fromSpy.mockClear();
  vi.resetModules();
});

// Helpers ----------------------------------------------------------
function makeOwnedTask(overrides: Partial<{ id: string }> = {}) {
  return {
    data: {
      id: overrides.id ?? "task-1",
      employees: { manager_id: "user-1" },
    },
    error: null,
  };
}

// Tests ------------------------------------------------------------
describe("deleteTasks", () => {
  it("deletes each owned task and returns the count", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedTask({ id: "t1" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t2" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t3" }));
    deleteEqSpy.mockResolvedValue({ error: null });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1", "t2", "t3"]);

    expect(result).toEqual({ deleted: 3, errors: [] });
    expect(deleteEqSpy).toHaveBeenCalledTimes(3);
    expect(deleteEqSpy).toHaveBeenNthCalledWith(1, "id", "t1");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(2, "id", "t2");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(3, "id", "t3");
  });

  it("treats a cross-manager task id as silent no-op (counts as deleted)", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { id: "t1", employees: { manager_id: "other-user" } },
      error: null,
    });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1"]);

    // No data leak, no error surfaced; counted as deleted per spec
    expect(result).toEqual({ deleted: 1, errors: [] });
    expect(deleteEqSpy).not.toHaveBeenCalled();
  });

  it("treats a missing task id as silent no-op (counts as deleted)", async () => {
    selectSingleSpy.mockResolvedValueOnce({ data: null, error: null });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t-missing"]);

    expect(result).toEqual({ deleted: 1, errors: [] });
    expect(deleteEqSpy).not.toHaveBeenCalled();
  });

  it("records partial failures and keeps going", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedTask({ id: "t1" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t2" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t3" }));
    deleteEqSpy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } })
      .mockResolvedValueOnce({ error: null });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1", "t2", "t3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("t2");
  });

  it("returns zero deleted on empty array without hitting Supabase", async () => {
    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks([]);

    expect(result).toEqual({ deleted: 0, errors: [] });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(selectSingleSpy).not.toHaveBeenCalled();
  });

  it("refuses in guest mode with a helpful error message", async () => {
    getGuestSessionIdSpy.mockResolvedValue("guest-123");

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1"]);

    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/אורח/);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
