import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteDialog } from "@/components/ui/delete-dialog";

describe("DeleteDialog", () => {
  it("shows single-item title and body when exactly one name is passed", () => {
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /מחיקת הסמכה/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/האם למחוק את דנה כהן\? פעולה זו אינה ניתנת לביטול\./)
    ).toBeInTheDocument();
  });

  it("shows bulk title with count and lists names when multiple names are passed", () => {
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן", "יוסי לוי", "מוש פרץ"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /מחיקת 3 הסמכות/ })
    ).toBeInTheDocument();
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
    expect(screen.getByText("יוסי לוי")).toBeInTheDocument();
    expect(screen.getByText("מוש פרץ")).toBeInTheDocument();
    expect(
      screen.getByText(/האם למחוק 3 הסמכות\? פעולה זו אינה ניתנת לביטול\./)
    ).toBeInTheDocument();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <DeleteDialog
        open={false}
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("invokes onCancel when the ביטול button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^ביטול$/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("invokes onConfirm and disables both buttons while loading", async () => {
    const onConfirm = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    );
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^מחק$/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // While in-flight, the confirm button shows a spinner label "מוחק..."
    expect(
      await screen.findByRole("button", { name: /מוחק\.\.\./ })
    ).toBeDisabled();
  });
});
