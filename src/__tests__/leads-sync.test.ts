import { describe, it, expect, vi, beforeEach } from "vitest";
import * as XLSX from "xlsx";

// --- Supabase mock: a tiny query builder that records calls ---
const insertCalls: unknown[][] = [];
const updateCalls: { id: string; values: Record<string, unknown> }[] = [];
// Per-test overrides for the {error} return shape of insert/update
const mockState: {
  insertError: { message: string } | null;
  updateError: { message: string } | null;
} = { insertError: null, updateError: null };

function makeQuery(table: string, existingRows: Record<string, unknown[]>) {
  return {
    select() {
      return {
        eq() {
          return {
            data: existingRows[table] ?? [],
            error: null,
          };
        },
      };
    },
    insert(rows: unknown[]) {
      insertCalls.push(rows);
      return { error: mockState.insertError };
    },
    update(values: Record<string, unknown>) {
      return {
        eq(_col: string, val: string) {
          return {
            eq() {
              updateCalls.push({ id: val, values });
              return { error: mockState.updateError };
            },
          };
        },
      };
    },
  };
}

const existingRows: Record<string, unknown[]> = {
  course_candidates: [
    { id: "row-existing", id_number: "123456782", phone: "050-111-2222" },
  ],
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => makeQuery(table, existingRows),
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

const fetchMock = vi.fn();
beforeEach(() => {
  insertCalls.length = 0;
  updateCalls.length = 0;
  mockState.insertError = null;
  mockState.updateError = null;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function buildXlsxBuffer(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["first name", "phone", "עיר", "מס׳ תעודת זהות"],
    // existing row (will UPDATE) — id_number 123456782, new city
    ["אברהם", "972502977325", "ירושלים", "123456782"],
    // brand-new row (will INSERT)
    ["שרה", "972506404601", "חיפה", "111111118"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("syncLeadsFromSheet", () => {
  it("inserts new rows, updates existing rows, and returns counts", async () => {
    const buf = buildXlsxBuffer();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buf,
    });

    const { syncLeadsFromSheet } = await import(
      "@/app/dashboard/candidates/sync-leads-action"
    );
    const summary = await syncLeadsFromSheet();

    expect(summary.inserted).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.total_rows).toBe(2);

    // The existing row was updated, with only the source-fields touched.
    // Notably last_name is NOT in the payload — the sheet has no last_name
    // column, so leaving it untouched preserves any curated value.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe("row-existing");
    expect(Object.keys(updateCalls[0].values).sort()).toEqual([
      "city",
      "first_name",
      "phone",
    ]);
    expect(updateCalls[0].values.city).toBe("ירושלים");

    // The new row was inserted with cert_type_id null and status "ליד חדש"
    expect(insertCalls).toHaveLength(1);
    const inserted = (insertCalls[0] as Record<string, unknown>[])[0];
    expect(inserted).toMatchObject({
      manager_id: "user-1",
      first_name: "שרה",
      cert_type_id: null,
      status: "ליד חדש",
    });
  });

  it("propagates fetch errors as a thrown error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const { syncLeadsFromSheet } = await import(
      "@/app/dashboard/candidates/sync-leads-action"
    );
    await expect(syncLeadsFromSheet()).rejects.toThrow(/403/);
  });

  it("throws when the bulk insert fails (does not silently report success)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buildXlsxBuffer(),
    });
    mockState.insertError = { message: "permission denied" };

    const { syncLeadsFromSheet } = await import(
      "@/app/dashboard/candidates/sync-leads-action"
    );
    await expect(syncLeadsFromSheet()).rejects.toThrow(/הכנסה נכשלה.*permission denied/);
  });

  it("throws when an update batch fails (does not silently report success)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => buildXlsxBuffer(),
    });
    mockState.updateError = { message: "constraint violation" };

    const { syncLeadsFromSheet } = await import(
      "@/app/dashboard/candidates/sync-leads-action"
    );
    await expect(syncLeadsFromSheet()).rejects.toThrow(/נכשלו 1 עדכונים.*constraint violation/);
  });

  it("translates a fetch transport rejection into a Hebrew error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const { syncLeadsFromSheet } = await import(
      "@/app/dashboard/candidates/sync-leads-action"
    );
    await expect(syncLeadsFromSheet()).rejects.toThrow(/שגיאת רשת.*בדוק את החיבור/);
  });
});
