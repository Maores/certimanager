import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { CourseCandidate } from "@/types/database";

// Mock next/navigation before importing the component
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Mock the server actions module
const promoteCandidate = vi.fn();
const promoteCandidates = vi.fn();
const updateCandidateStatus = vi.fn();
const deleteCandidate = vi.fn();

vi.mock("@/app/dashboard/candidates/actions", () => ({
  promoteCandidate: (...args: unknown[]) => promoteCandidate(...args),
  promoteCandidates: (...args: unknown[]) => promoteCandidates(...args),
  updateCandidateStatus: (...args: unknown[]) => updateCandidateStatus(...args),
  deleteCandidate: (...args: unknown[]) => deleteCandidate(...args),
}));

// Import after mocks
import { CandidatesTable } from "@/components/candidates/candidates-table";

function makeCandidate(overrides: Partial<CourseCandidate> = {}): CourseCandidate {
  return {
    id: "c1",
    manager_id: "m1",
    first_name: "דנה",
    last_name: "כהן",
    id_number: "111222333",
    phone: "050-1234567",
    city: "תל אביב",
    cert_type_id: "ct1",
    cert_type_name: "נת״ע",
    status: "ממתין",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    is_employee: false,
    ...overrides,
  };
}

describe("CandidatesTable — promote button visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the clickable UserPlus button when candidate is not yet an employee", () => {
    render(<CandidatesTable candidates={[makeCandidate({ is_employee: false })]} />);

    const btn = screen.getByRole("button", { name: /קדם דנה כהן לעובד/ });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("hides the promote button and shows an 'already employee' indicator when is_employee is true", () => {
    render(<CandidatesTable candidates={[makeCandidate({ is_employee: true })]} />);

    expect(screen.queryByRole("button", { name: /קדם דנה כהן לעובד/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/דנה כהן כבר עובד/)).toBeInTheDocument();
  });
});

describe("CandidatesTable — success banner and auto-dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows success banner when server action returns status="promoted"', async () => {
    promoteCandidate.mockResolvedValue({ status: "promoted", name: "דנה כהן" });

    render(<CandidatesTable candidates={[makeCandidate()]} />);

    fireEvent.click(screen.getByRole("button", { name: /קדם דנה כהן לעובד/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^קדם לעובד$/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/דנה כהן נוסף בהצלחה לרשימת העובדים/);
    });
  });

  it('shows combined message when bulk action returns already_employee count', async () => {
    promoteCandidates.mockResolvedValue({ promoted: 1, already_employee: 1, errors: [] });

    render(
      <CandidatesTable
        candidates={[
          makeCandidate({ id: "c1", first_name: "דנה", last_name: "כהן" }),
          makeCandidate({ id: "c2", first_name: "יוסי", last_name: "לוי", is_employee: true, status: "הוסמך" }),
        ]}
      />
    );

    // Select both candidates — this makes promoteDialog.ids.length === 2 → bulk path
    fireEvent.click(screen.getByRole("checkbox", { name: /בחר דנה כהן/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחר יוסי לוי/ }));
    fireEvent.click(await screen.findByRole("button", { name: /קדם לעובדים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^קדם לעובד$/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/1 כבר היו עובדים/);
    });
  });

  it("auto-dismisses success banner after ~7 seconds", async () => {
    promoteCandidate.mockResolvedValue({ status: "promoted", name: "דנה כהן" });

    render(<CandidatesTable candidates={[makeCandidate()]} />);

    fireEvent.click(screen.getByRole("button", { name: /קדם דנה כהן לעובד/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^קדם לעובד$/ }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    // Wait for the real 7s auto-dismiss timeout to fire
    await waitFor(
      () => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      },
      { timeout: 8500, interval: 250 }
    );
  }, 10000);
});

describe("CandidatesTable — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces a failure from promoteCandidate into the error banner", async () => {
    promoteCandidate.mockRejectedValue(new Error("שגיאה בשמירת הנתונים"));

    render(<CandidatesTable candidates={[makeCandidate()]} />);

    fireEvent.click(screen.getByRole("button", { name: /קדם דנה כהן לעובד/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^קדם לעובד$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/שגיאה בשמירת הנתונים/);
    });
  });
});
