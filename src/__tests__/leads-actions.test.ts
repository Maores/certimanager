import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState: { error: { code?: string; message: string } | null } = {
  error: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    // The second `.eq()` is the terminal call for updateLeadField but is also
    // followed by `.is(...)` for markLeadRead — we make both shapes resolve to
    // the same {error} so either action's error path is exercisable.
    const terminal = {
      error: undefined as { code?: string; message: string } | null | undefined,
      is: () => ({ error: mockState.error }),
      then: undefined as unknown,
    };
    Object.defineProperty(terminal, "error", {
      get: () => mockState.error,
    });
    return {
      from: () => ({
        update: () => ({
          eq: () => ({ eq: () => terminal }),
        }),
      }),
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
    };
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`redirect: ${p}`);
  }),
}));

beforeEach(() => {
  mockState.error = null;
  vi.resetModules();
});

describe("updateLeadField — UNIQUE-violation surfacing", () => {
  it("throws a Hebrew message when assigning cert_type_id collides with an existing candidate row", async () => {
    mockState.error = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "course_candidates_manager_id_id_number_cert_type_id_key"',
    };
    const { updateLeadField } = await import(
      "@/app/dashboard/candidates/leads-actions"
    );
    await expect(
      updateLeadField("lead-1", "cert_type_id", "cert-type-x")
    ).rejects.toThrow(/אדם זה כבר רשום לקורס הזה.*מועמדים/);
  });

  it("matches by message text too (driver may not surface a code)", async () => {
    mockState.error = { message: "unique constraint violated on cert_type_id" };
    const { updateLeadField } = await import(
      "@/app/dashboard/candidates/leads-actions"
    );
    await expect(
      updateLeadField("lead-1", "cert_type_id", "cert-type-x")
    ).rejects.toThrow(/אדם זה כבר רשום לקורס הזה/);
  });

  it("throws a generic Hebrew error for non-UNIQUE failures", async () => {
    mockState.error = { code: "23503", message: "foreign key constraint failed" };
    const { updateLeadField } = await import(
      "@/app/dashboard/candidates/leads-actions"
    );
    await expect(
      updateLeadField("lead-1", "cert_type_id", "cert-type-x")
    ).rejects.toThrow(/עדכון נכשל.*foreign key/);
  });

  it("does NOT translate UNIQUE errors when updating non-cert_type fields (different root cause)", async () => {
    mockState.error = { code: "23505", message: "duplicate key" };
    const { updateLeadField } = await import(
      "@/app/dashboard/candidates/leads-actions"
    );
    await expect(updateLeadField("lead-1", "city", "תל אביב")).rejects.toThrow(
      /עדכון נכשל.*duplicate key/
    );
  });

  it("does not throw when there is no error", async () => {
    mockState.error = null;
    const { updateLeadField } = await import(
      "@/app/dashboard/candidates/leads-actions"
    );
    await expect(
      updateLeadField("lead-1", "status", "נוצר קשר")
    ).resolves.toBeUndefined();
  });
});
