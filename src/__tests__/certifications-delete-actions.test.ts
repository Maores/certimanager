import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ------------------------------------------------------------
const selectSingleSpy = vi.fn();
const deleteEqSpy = vi.fn();
const storageRemoveSpy = vi.fn();
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
    storage: {
      from: (_bucket: string) => ({ remove: storageRemoveSpy }),
    },
  })),
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: (...args: unknown[]) => getGuestSessionIdSpy(...args),
}));

vi.mock("@/lib/guest-store", () => ({
  guestCreateCertification: vi.fn(),
  guestUpdateCertification: vi.fn(),
  guestDeleteCertification: vi.fn(),
  getGuestData: vi.fn(),
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
  storageRemoveSpy.mockReset();
  getGuestSessionIdSpy.mockReset();
  getGuestSessionIdSpy.mockResolvedValue(null);
  fromSpy.mockClear();
  vi.resetModules();
});

// Helpers ----------------------------------------------------------
function makeOwnedCert(overrides: Partial<{ id: string; image_url: string | null }> = {}) {
  return {
    data: {
      id: overrides.id ?? "cert-1",
      image_url: overrides.image_url ?? null,
      employees: { manager_id: "user-1" },
    },
    error: null,
  };
}

// Tests ------------------------------------------------------------
describe("deleteCertifications", () => {
  it("deletes each owned cert and returns the count", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedCert({ id: "c1" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c2" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c3" }));
    deleteEqSpy.mockResolvedValue({ error: null });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1", "c2", "c3"]);

    expect(result).toEqual({ deleted: 3, errors: [] });
    expect(deleteEqSpy).toHaveBeenCalledTimes(3);
    expect(deleteEqSpy).toHaveBeenNthCalledWith(1, "id", "c1");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(2, "id", "c2");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(3, "id", "c3");
    // No image_url on any cert → storage.remove NOT called
    expect(storageRemoveSpy).not.toHaveBeenCalled();
  });

  it("cleans up cert-images storage for deleted rows that had image_url", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(
        makeOwnedCert({ id: "c1", image_url: "certs/aaa.jpg" })
      )
      .mockResolvedValueOnce(
        makeOwnedCert({ id: "c2", image_url: null })
      )
      .mockResolvedValueOnce(
        makeOwnedCert({ id: "c3", image_url: "certs/bbb.pdf" })
      );
    deleteEqSpy.mockResolvedValue({ error: null });
    storageRemoveSpy.mockResolvedValue({ data: [], error: null });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1", "c2", "c3"]);

    expect(result.deleted).toBe(3);
    expect(storageRemoveSpy).toHaveBeenCalledTimes(1);
    expect(storageRemoveSpy).toHaveBeenCalledWith([
      "certs/aaa.jpg",
      "certs/bbb.pdf",
    ]);
  });

  it("tolerates a storage cleanup failure without failing the whole action", async () => {
    selectSingleSpy.mockResolvedValueOnce(
      makeOwnedCert({ id: "c1", image_url: "certs/aaa.jpg" })
    );
    deleteEqSpy.mockResolvedValue({ error: null });
    storageRemoveSpy.mockRejectedValue(new Error("storage down"));

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1"]);

    // DB delete succeeded; storage failure is swallowed
    expect(result).toEqual({ deleted: 1, errors: [] });
  });

  it("treats a cross-manager cert id as silent no-op (counts as deleted)", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { id: "c1", image_url: null, employees: { manager_id: "other-user" } },
      error: null,
    });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1"]);

    // No data leak, no error surfaced; counted as deleted per spec
    expect(result).toEqual({ deleted: 1, errors: [] });
    expect(deleteEqSpy).not.toHaveBeenCalled();
  });

  it("records partial failures and keeps going", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedCert({ id: "c1" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c2" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c3" }));
    deleteEqSpy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } })
      .mockResolvedValueOnce({ error: null });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1", "c2", "c3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("c2");
  });

  it("returns zero deleted on empty array without hitting Supabase", async () => {
    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications([]);

    expect(result).toEqual({ deleted: 0, errors: [] });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(selectSingleSpy).not.toHaveBeenCalled();
  });

  it("refuses in guest mode with a helpful error message", async () => {
    getGuestSessionIdSpy.mockResolvedValue("guest-123");

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1"]);

    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/אורח/);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
