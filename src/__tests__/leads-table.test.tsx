import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

// LeadsTable renders both layouts in the DOM (toggled by Tailwind responsive
// classes). jsdom has no media queries, so both are present at test time —
// tests scope to one or the other via data-testid wrappers.

describe("LeadsTable — desktop table", () => {
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
    const desktop = screen.getByTestId("leads-desktop");
    const cell = within(desktop).getByText("ללא שם");
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
    const desktop = screen.getByTestId("leads-desktop");
    expect(within(desktop).getByText("A")).toBeInTheDocument();
    expect(within(desktop).queryByText("B")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /הצג גם לא מעוניין/ }));

    expect(within(desktop).getByText("A")).toBeInTheDocument();
    expect(within(desktop).getByText("B")).toBeInTheDocument();
  });
});

describe("LeadsTable — mobile cards", () => {
  beforeEach(() => {
    markLeadRead.mockReset();
    updateLeadField.mockReset();
  });

  it("renders one card per visible lead inside the mobile container", () => {
    render(
      <LeadsTable
        leads={[
          makeLead({ id: "lead-a", first_name: "A" }),
          makeLead({ id: "lead-b", first_name: "B" }),
        ]}
        certTypes={[]}
      />
    );
    const mobile = screen.getByTestId("leads-mobile");
    const cards = within(mobile).getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(mobile).getByText("A")).toBeInTheDocument();
    expect(within(mobile).getByText("B")).toBeInTheDocument();
  });

  it("applies the unread tint to a card when read_at is null", () => {
    render(<LeadsTable leads={[makeLead({ read_at: null })]} certTypes={[]} />);
    const mobile = screen.getByTestId("leads-mobile");
    const card = within(mobile).getByRole("article", { name: /אברהם/ });
    expect(card.className).toMatch(/bg-yellow-50/);
  });

  it("calls markLeadRead when an unread card is tapped", () => {
    render(<LeadsTable leads={[makeLead()]} certTypes={[]} />);
    const mobile = screen.getByTestId("leads-mobile");
    fireEvent.click(within(mobile).getByRole("article", { name: /אברהם/ }));
    expect(markLeadRead).toHaveBeenCalledWith("lead-1");
  });

  it("does not call markLeadRead when tapping the status select inside a card", () => {
    render(<LeadsTable leads={[makeLead()]} certTypes={[]} />);
    const mobile = screen.getByTestId("leads-mobile");
    const card = within(mobile).getByRole("article", { name: /אברהם/ });
    const statusSelect = within(card).getByDisplayValue("ליד חדש");
    fireEvent.change(statusSelect, { target: { value: "נוצר קשר" } });
    expect(markLeadRead).not.toHaveBeenCalled();
    expect(updateLeadField).toHaveBeenCalledWith("lead-1", "status", "נוצר קשר");
  });

  it("hides 'אישור משטרה' / הערות / עיר behind an expand toggle by default", () => {
    render(<LeadsTable leads={[makeLead()]} certTypes={[]} />);
    const mobile = screen.getByTestId("leads-mobile");
    const card = within(mobile).getByRole("article", { name: /אברהם/ });
    // The police-clearance select is in the expand area. Defaults to לא נשלח —
    // present in the status select options too, so check via display value.
    expect(within(card).queryByDisplayValue("לא נשלח")).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: /עוד פרטים/ }));
    expect(within(card).getByDisplayValue("לא נשלח")).toBeInTheDocument();
  });

  it("shows the empty-name placeholder with a red border + tooltip in the card", () => {
    render(<LeadsTable leads={[makeLead({ first_name: "ללא שם" })]} certTypes={[]} />);
    const mobile = screen.getByTestId("leads-mobile");
    const placeholder = within(mobile).getByText("ללא שם");
    expect(placeholder.className).toMatch(/border-red/);
    expect(placeholder.getAttribute("title")).toMatch(/שם חסר/);
  });
});
