import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CourseCandidate } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const markLeadRead = vi.fn();
const updateLeadField = vi.fn();
vi.mock("@/app/dashboard/candidates/leads-actions", () => ({
  markLeadRead: (...args: unknown[]) => markLeadRead(...args),
  updateLeadField: (...args: unknown[]) => updateLeadField(...args),
}));

import { LeadsTable } from "@/components/candidates/leads-table";

function makeLead(overrides: Partial<CourseCandidate> = {}): CourseCandidate {
  return {
    id: "lead-1",
    manager_id: "m1",
    first_name: "אברהם",
    last_name: "",
    id_number: "123456782",
    phone: "050-111-2222",
    city: "תל אביב",
    cert_type_id: null,
    cert_type_name: undefined,
    status: "ליד חדש",
    notes: null,
    police_clearance_status: "לא נשלח",
    read_at: null,
    created_at: "2026-05-03T00:00:00Z",
    updated_at: "2026-05-03T00:00:00Z",
    ...overrides,
  };
}

describe("LeadsTable", () => {
  beforeEach(() => {
    markLeadRead.mockReset();
    updateLeadField.mockReset();
  });

  it("renders an unread tint on rows where read_at is null", () => {
    render(<LeadsTable leads={[makeLead({ read_at: null })]} certTypes={[]} />);
    const row = screen.getByRole("row", { name: /אברהם/ });
    expect(row.className).toMatch(/bg-yellow-50|bg-pink-50/);
  });

  it("does NOT render the unread tint when read_at is set", () => {
    render(
      <LeadsTable
        leads={[makeLead({ read_at: "2026-05-03T00:00:00Z" })]}
        certTypes={[]}
      />
    );
    const row = screen.getByRole("row", { name: /אברהם/ });
    expect(row.className).not.toMatch(/bg-yellow-50|bg-pink-50/);
  });

  it("calls markLeadRead when a row is clicked while unread", () => {
    render(<LeadsTable leads={[makeLead()]} certTypes={[]} />);
    fireEvent.click(screen.getByRole("row", { name: /אברהם/ }));
    expect(markLeadRead).toHaveBeenCalledWith("lead-1");
  });

  it("shows a red border + tooltip on rows where the name is the placeholder", () => {
    render(<LeadsTable leads={[makeLead({ first_name: "ללא שם" })]} certTypes={[]} />);
    const cell = screen.getByText("ללא שם");
    expect(cell.className).toMatch(/border-red/);
    expect(cell.getAttribute("title")).toMatch(/שם חסר/);
  });

  it("hides 'לא מעוניין' rows by default and reveals them when checkbox toggled", () => {
    render(
      <LeadsTable
        leads={[
          makeLead({ id: "lead-a", first_name: "A", status: "ליד חדש" }),
          makeLead({ id: "lead-b", first_name: "B", status: "לא מעוניין" }),
        ]}
        certTypes={[]}
      />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /הצג גם לא מעוניין/ }));

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});
