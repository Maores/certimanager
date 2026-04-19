/**
 * _fixture-smoke.test.ts
 *
 * Smoke tests for the agent harness xlsx fixtures.
 * Verifies that the three pikoh fixtures parse correctly via the project's
 * real excel parser (src/lib/excel-parser.ts).
 *
 * Real export: parseExcel(buffer: ArrayBuffer): ParseResult
 * ParseResult.sheets[].workers[] holds ParsedWorker objects.
 * ParseResult.totalParsed = total rows that survived all skip guards.
 * ParseResult.certTypeNames = unique cert type names discovered across sheets.
 */

import { describe, it, expect } from "vitest";
import { parseExcel } from "@/lib/excel-parser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (name: string): ArrayBuffer => {
  const buf = readFileSync(
    resolve(process.cwd(), "tests/agents/fixtures", name)
  );
  // Create a fresh ArrayBuffer — Node Buffers share a pool, so buf.buffer
  // alone would return the entire pool backing buffer, not just the file bytes.
  const ab = new ArrayBuffer(buf.length);
  new Uint8Array(ab).set(buf);
  return ab;
};

describe("xlsx fixtures — parser smoke", () => {
  it("pikoh-happy.xlsx parses to 10 employee rows with all 4 cert types", () => {
    const result = parseExcel(read("pikoh-happy.xlsx"));

    // Total parsed rows must be 10 (all clean)
    expect(result.totalParsed).toBe(10);
    expect(result.totalSkipped).toBe(0);

    // Collect cert type names assigned to workers across all sheets
    const allWorkers = result.sheets.flatMap((s) => s.workers);
    expect(allWorkers).toHaveLength(10);

    const typeNames = new Set(
      allWorkers.map((w) => w.certTypeName ?? "")
    );
    for (const t of ["נת״ע", "כביש 6", "חוצה ישראל", "נתיבי ישראל"]) {
      expect(typeNames.has(t)).toBe(true);
    }
  });

  it("pikoh-empty.xlsx parses to zero rows without throwing", () => {
    const result = parseExcel(read("pikoh-empty.xlsx"));
    expect(result.totalParsed).toBe(0);
    expect(result.totalSkipped).toBe(0);
    const allWorkers = result.sheets.flatMap((s) => s.workers);
    expect(allWorkers).toHaveLength(0);
  });

  it("pikoh-dirty.xlsx parses without throwing (shape validation is the subject of the journey)", () => {
    // Should not throw — parser is lenient and skips/passes bad rows.
    expect(() => parseExcel(read("pikoh-dirty.xlsx"))).not.toThrow();
    const result = parseExcel(read("pikoh-dirty.xlsx"));
    // Some rows are skipped (rows A and E have empty employee numbers → skipped).
    // The rest are parsed (even if with null dates or unknown cert types).
    expect(result.totalParsed + result.totalSkipped).toBe(10);
  });
});
