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
  it("matches by id_number first when the checksum is valid", () => {
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

  it("falls back to phone match when ID checksum is invalid", () => {
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

  it("does not match by phone when incoming phone is invalid", () => {
    const incoming = [
      lead({
        id_number: "999999999",
        flags: { empty_name: false, invalid_phone: true, invalid_id: true },
        phone: "abc",
      }),
    ];
    const existing: ExistingRow[] = [
      { id: "row-1", id_number: "111111111", phone: "abc" },
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
