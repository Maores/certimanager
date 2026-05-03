import { describe, it, expect } from "vitest";
import { dedupLeads } from "@/lib/leads/dedup";
import type { NormalizedLead } from "@/lib/leads/types";

interface ExistingRow {
  id: string;
  id_number: string;
  phone: string | null;
}

function lead(overrides: Partial<NormalizedLead> = {}): NormalizedLead {
  return {
    first_name: "אברהם",
    phone: "050-111-2222",
    city: "תל אביב",
    id_number: "123456782",
    source_row_number: 2,
    flags: { empty_name: false, invalid_phone: false, invalid_id: false },
    ...overrides,
  };
}

describe("dedupLeads", () => {
  it("matches by id_number when the same string already exists", () => {
    const incoming = [lead({ phone: "050-999-9999" })];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "123456782", phone: "050-111-2222" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0]).toMatchObject({
      existing_id: "row-1",
      lead: incoming[0],
    });
    expect(result.toInsert).toHaveLength(0);
  });

  it("falls back to phone match when the ID is absent from existing rows", () => {
    const incoming = [
      lead({
        id_number: "123456789",
        flags: { empty_name: false, invalid_phone: false, invalid_id: true },
        phone: "050-111-2222",
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "999999999", phone: "050-111-2222" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existing_id).toBe("row-1");
  });

  it("inserts when neither id_number nor phone matches", () => {
    const incoming = [lead()];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "999999999", phone: "050-999-9999" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("matches by id_number even when checksum is invalid (verbatim string match)", () => {
    // Re-syncs of garbage IDs (e.g. typos, partial digits) still need to be
    // idempotent — same string in source ⇒ same row in DB.
    const incoming = [
      lead({
        id_number: "בהא",
        flags: { empty_name: false, invalid_phone: false, invalid_id: true },
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "בהא", phone: null },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existing_id).toBe("row-1");
    expect(result.toInsert).toHaveLength(0);
  });

  it("matches by phone string verbatim even when the format is invalid", () => {
    // Same reason as above for phones — landlines and other non-mobile formats
    // still need to round-trip across syncs without duplicating.
    const incoming = [
      lead({
        id_number: "",
        flags: { empty_name: false, invalid_phone: true, invalid_id: true },
        phone: "02-1234567",
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "", phone: "02-1234567" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existing_id).toBe("row-1");
    expect(result.toInsert).toHaveLength(0);
  });

  it("does not match when both id_number and phone are empty", () => {
    // A completely-blank lead has no identifier; a duplicate row will be
    // created on every sync. That's acceptable — there's no way to tell
    // such rows apart.
    const incoming = [
      lead({
        id_number: "",
        phone: "",
        flags: { empty_name: false, invalid_phone: true, invalid_id: true },
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "", phone: null },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("prefers id_number match over a competing phone match", () => {
    const incoming = [lead({ id_number: "123456782", phone: "050-111-2222" })];
    const existing: ExistingRow[] = [
      { id: "row-by-phone", id_number: "999999999", phone: "050-111-2222" },
      { id: "row-by-id", id_number: "123456782", phone: "050-999-9999" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existing_id).toBe("row-by-id");
  });
});
