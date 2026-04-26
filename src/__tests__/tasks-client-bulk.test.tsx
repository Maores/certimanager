import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const deleteTasks = vi.fn();
const updateTaskStatus = vi.fn();
const deleteTask = vi.fn();
const createTask = vi.fn();
vi.mock("@/app/dashboard/tasks/actions", () => ({
  deleteTasks: (...args: unknown[]) => deleteTasks(...args),
  updateTaskStatus: (...args: unknown[]) => updateTaskStatus(...args),
  deleteTask: (...args: unknown[]) => deleteTask(...args),
  createTask: (...args: unknown[]) => createTask(...args),
}));

import { TasksClient } from "@/app/dashboard/tasks/tasks-client";

type Task = {
  id: string;
  employee_id: string;
  description: string;
  responsible: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  employee_name: string;
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    employee_id: "emp-1",
    description: "החלף שמן",
    responsible: null,
    status: "פתוח",
    created_at: "2026-04-20T08:00:00Z",
    updated_at: "2026-04-20T08:00:00Z",
    employee_name: "דנה כהן",
    ...overrides,
  };
}

const baseProps = {
  employees: [{ id: "emp-1", name: "דנה כהן" }],
  responsibleList: [],
  counts: { "פתוח": 0, "בטיפול": 0, "הושלם": 0 },
  statusFilter: "",
  responsibleFilter: "",
};

// jsdom renders both desktop and mobile views regardless of the Tailwind
// breakpoint (CSS-only), so per-row checkboxes appear twice. Scope queries
// to the desktop view; browser verification (Task 8) covers mobile visually.
function desktop() {
  return within(screen.getByTestId("tasks-desktop"));
}

describe("TasksClient — selection UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a checkbox for each row and a select-all in the table header", () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר הכל/ })
    ).toBeInTheDocument();
  });

  it("select-all toggles all rows", () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
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
    render(<TasksClient {...baseProps} tasks={[makeTask()]} />);
    expect(
      screen.queryByRole("button", { name: /מחק נבחרים/ })
    ).not.toBeInTheDocument();
  });

  it("shows the bulk action bar with count when at least one row is selected", () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
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
});

describe("TasksClient — bulk delete flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking 'מחק נבחרים' opens the dialog with selected names listed", async () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן", description: "החלף שמן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי", description: "ביטוח רכב" }),
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
      name: /מחיקת 2 משימות/,
    });
    expect(within(dialog).getByText(/דנה כהן.*החלף שמן/)).toBeInTheDocument();
    expect(within(dialog).getByText(/יוסי לוי.*ביטוח רכב/)).toBeInTheDocument();
  });

  it("confirm calls deleteTasks with selected ids and shows success", async () => {
    deleteTasks.mockResolvedValue({ deleted: 2, errors: [] });

    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
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
      expect(deleteTasks).toHaveBeenCalledWith(["a", "b"]);
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/נמחקו 2 משימות/);
    });
  });

  it("cancel closes the dialog without calling deleteTasks; selection preserved", async () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[makeTask({ id: "a", employee_name: "דנה כהן" })]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^ביטול$/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /מחיקת/ })
      ).not.toBeInTheDocument();
    });
    expect(deleteTasks).not.toHaveBeenCalled();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
  });

  it("partial failure surfaces an error banner AND keeps failed rows selected for retry", async () => {
    deleteTasks.mockResolvedValue({
      deleted: 1,
      errors: ["b: שגיאה במחיקה"],
    });

    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
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
      expect(alert).toHaveTextContent(/נמחקה משימה אחת/);
      expect(alert).toHaveTextContent(/שגיאה במחיקה/);
    });

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).not.toBeChecked();
  });

  it("thrown error preserves selection and shows the error banner", async () => {
    deleteTasks.mockRejectedValue(new Error("network boom"));

    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
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
