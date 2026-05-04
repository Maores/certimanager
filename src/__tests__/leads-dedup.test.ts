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

  it("does NOT use weak (Hebrew/short) id_numbers as dedup keys — falls through to phone", () => {
    // The live sheet has rows where the city or a single zero is pasted into
    // the ID field. These collide across distinct people; we treat them as
    // unidentifiable and rely on phone instead.
    const incoming = [
      lead({
        id_number: "בהא",
        phone: "050-111-2222",
        flags: { empty_name: false, invalid_phone: false, invalid_id: true },
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-by-phone", id_number: "ירושלים", phone: "050-111-2222" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(1);
    expect(result.toUpdate[0].existing_id).toBe("row-by-phone");
  });

  it("does NOT use non-mobile phone strings as dedup keys", () => {
    const incoming = [
      lead({
        id_number: "",
        phone: "02-1234567",
        flags: { empty_name: false, invalid_phone: true, invalid_id: true },
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "", phone: "02-1234567" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toUpdate).toHaveLength(0);
  });

  it("matches each existing row at most once (1-to-1 queue)", () => {
    // Three incoming leads share id "0" — a placeholder. Two existing rows
    // also have id "0". Without 1-to-1 matching all three would collapse onto
    // one DB slot and the extras would be silently lost. With queueing, we
    // skip the weak id entirely and fall through to phone — each unique phone
    // claims a distinct existing row, the third inserts as new.
    const incoming = [
      lead({ id_number: "0", phone: "050-111-1111" }),
      lead({ id_number: "0", phone: "050-222-2222" }),
      lead({ id_number: "0", phone: "050-333-3333" }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "0", phone: "050-111-1111" },
      { id: "row-2", id_number: "0", phone: "050-222-2222" },
    ];
    const result = dedupLeads(incoming, existing);
    expect(result.toUpdate).toHaveLength(2);
    expect(result.toUpdate.map((m) => m.existing_id).sort()).toEqual([
      "row-1",
      "row-2",
    ]);
    expect(result.toInsert).toHaveLength(1);
    expect(result.toInsert[0].phone).toBe("050-333-3333");
  });

  it("does not match when both id_number and phone are weak", () => {
    // A completely-blank or weak-only lead has no identifier — duplicate
    // rows will be created on every sync. That's acceptable; there's no
    // way to tell such rows apart.
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

  it("prefers id_number match over a competing phone match (when both strong)", () => {
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
