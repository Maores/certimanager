import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import type { CertRow } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const deleteCertifications = vi.fn();
vi.mock("@/app/dashboard/certifications/actions", () => ({
  deleteCertifications: (...args: unknown[]) => deleteCertifications(...args),
  deleteCertification: vi.fn(),
}));

// Import after mocks
import { CertificationsList } from "@/components/certifications/certifications-list";

function makeCert(overrides: Partial<CertRow> = {}): CertRow {
  return {
    id: "cert-1",
    employee_name: "דנה כהן",
    employee_department: "נת״ע",
    cert_type_id: "ct-1",
    cert_type_name: "נהיגה",
    issue_date: "2025-01-01",
    expiry_date: "2027-01-01",
    next_refresh_date: null,
    image_url: null,
    status: "valid",
    ...overrides,
  };
}

// Helper: scope queries to the desktop table only.
// In jsdom, both the desktop table and the mobile card list render (Tailwind's
// `hidden md:block` / `md:hidden` are CSS-only and jsdom does not evaluate the
// media query), so per-row labels appear twice. We assert against the desktop
// view; browser verification (Task 5) covers mobile visually.
function desktop() {
  return within(screen.getByTestId("certs-desktop"));
}

describe("CertificationsList — selection UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a checkbox for each row and a select-all in the table header", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeInTheDocument();
    // Select-all exists once (desktop table only)
    expect(
      desktop().getByRole("checkbox", { name: /בחר הכל/ })
    ).toBeInTheDocument();
  });

  it("select-all toggles all rows", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    const selectAll = desktop().getByRole("checkbox", { name: /בחר הכל/ });
    fireEvent.click(selectAll);

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();

    fireEvent.click(selectAll);

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).not.toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).not.toBeChecked();
  });

  it("hides the bulk action bar when nothing is selected", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[makeCert()]}
      />
    );
    expect(
      screen.queryByRole("button", { name: /מחק נבחרים/ })
    ).not.toBeInTheDocument();
  });

  it("shows the bulk action bar with count when at least one row is selected", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    expect(screen.getByText(/1 נבחרו/)).toBeInTheDocument();
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    expect(screen.getByText(/2 נבחרו/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /מחק נבחרים/ })
    ).toBeInTheDocument();
  });

  it("hides all selection UI in guest mode", () => {
    render(
      <CertificationsList
        isGuest={true}
        certs={[makeCert()]}
      />
    );
    // No select-all, no per-row checkboxes anywhere
    expect(
      screen.queryByRole("checkbox", { name: /בחר הכל/ })
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox", { name: /בחר/ })).toHaveLength(0);
  });
});

describe("CertificationsList — bulk delete flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking 'מחק נבחרים' opens the dialog with selected names listed", async () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({
            id: "a",
            employee_name: "דנה כהן",
            cert_type_name: "נהיגה",
          }),
          makeCert({
            id: "b",
            employee_name: "יוסי לוי",
            cert_type_name: "ריתוך",
          }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));

    const dialog = await screen.findByRole("dialog", {
      name: /מחיקת 2 הסמכות/,
    });
    expect(within(dialog).getByText(/דנה כהן.*נהיגה/)).toBeInTheDocument();
    expect(within(dialog).getByText(/יוסי לוי.*ריתוך/)).toBeInTheDocument();
  });

  it("confirm calls deleteCertifications with selected ids and shows success", async () => {
    deleteCertifications.mockResolvedValue({ deleted: 2, errors: [] });

    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      expect(deleteCertifications).toHaveBeenCalledWith(["a", "b"]);
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/נמחקו 2 הסמכות/);
    });
  });

  it("cancel closes the dialog without calling the server action", async () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^ביטול$/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /מחיקת הסמכה/ })
      ).not.toBeInTheDocument();
    });
    expect(deleteCertifications).not.toHaveBeenCalled();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
  });

  it("partial failure surfaces an error banner AND keeps failed rows selected for retry", async () => {
    deleteCertifications.mockResolvedValue({
      deleted: 1,
      errors: ["b: permission denied"],
    });

    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/נמחקה הסמכה אחת/);
      expect(alert).toHaveTextContent(/permission denied/);
    });

    // Per spec: failing rows stay selected so the user can retry.
    // The successful row "a" is no longer checked (router.refresh would remove it),
    // but "b" (the failure) should remain checked in the component state.
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).not.toBeChecked();
  });

  it("thrown error preserves selection and shows the error banner", async () => {
    deleteCertifications.mockRejectedValue(new Error("network boom"));

    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network boom/);
    });
    // Dialog closed; both selections preserved so the user can retry cleanly.
    expect(
      screen.queryByRole("heading", { name: /מחיקת/ })
    ).not.toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();
  });
});
