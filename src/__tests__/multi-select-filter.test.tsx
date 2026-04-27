import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

const sampleOptions = [
  { value: "ct-1", label: "נהיגה" },
  { value: "ct-2", label: "ריתוך" },
  { value: "ct-3", label: "עבודה בגובה" },
];

/**
 * Render the component inside a real <form> with a stub submit handler so we
 * can assert auto-submit behavior. Returns the form element + submit spy.
 */
function renderInsideForm(initialSelected: string[] = []) {
  const submitSpy = vi.fn();
  const ref: { form: HTMLFormElement | null } = { form: null };
  render(
    <form
      ref={(el) => {
        ref.form = el;
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submitSpy();
      }}
    >
      <MultiSelectFilter
        name="type"
        options={sampleOptions}
        selected={initialSelected}
        placeholder="כל סוגי ההסמכה"
        ariaLabel="סינון לפי סוג הסמכה"
      />
    </form>
  );
  // jsdom's HTMLFormElement.submit() doesn't fire the submit event handler,
  // so we override it with a function that DOES, in order to test the
  // auto-submit behavior.
  if (ref.form) {
    ref.form.submit = () => submitSpy();
  }
  return { submitSpy, form: ref.form! };
}

describe("MultiSelectFilter — trigger label", () => {
  it("shows the placeholder when nothing is selected", () => {
    renderInsideForm([]);
    expect(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    ).toHaveTextContent("כל סוגי ההסמכה");
  });

  it("shows the single option's label when exactly one is selected", () => {
    renderInsideForm(["ct-2"]);
    expect(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    ).toHaveTextContent("ריתוך");
  });

  it("shows 'N נבחרו' when more than one is selected", () => {
    renderInsideForm(["ct-1", "ct-3"]);
    expect(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    ).toHaveTextContent("2 נבחרו");
  });
});

describe("MultiSelectFilter — dropdown + selection", () => {
  it("opens the listbox on trigger click and lists every option as a checkbox", () => {
    renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByRole("checkbox", { name: "נהיגה" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "ריתוך" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "עבודה בגובה" })
    ).toBeInTheDocument();
  });

  it("toggling a checkbox adds it to the hidden form value", () => {
    const { form } = renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "ריתוך" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "נהיגה" }));

    const hidden = form.querySelector(
      "input[type=hidden][name=type]"
    ) as HTMLInputElement;
    expect(hidden.value.split(",").sort()).toEqual(["ct-1", "ct-2"]);
  });

  it("toggling a selected checkbox removes it", () => {
    const { form } = renderInsideForm(["ct-1"]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "נהיגה" }));

    const hidden = form.querySelector(
      "input[type=hidden][name=type]"
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
  });

  it("'נקה הכל' clears the selection but keeps the dropdown open", () => {
    const { form } = renderInsideForm(["ct-1", "ct-2"]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /נקה הכל/ }));

    const hidden = form.querySelector(
      "input[type=hidden][name=type]"
    ) as HTMLInputElement;
    expect(hidden.value).toBe("");
    // listbox still open
    expect(screen.queryByRole("listbox")).toBeInTheDocument();
  });

  it("renders the 'נקה הכל' slot even when nothing is selected (disabled) so the checkbox rows below don't shift on first/last toggle", () => {
    renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    const clearBtn = screen.getByRole("button", { name: /נקה הכל/ });
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toBeDisabled();
  });

  it("'נקה הכל' becomes enabled once at least one option is selected", () => {
    renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "נהיגה" }));
    expect(screen.getByRole("button", { name: /נקה הכל/ })).toBeEnabled();
  });
});

describe("MultiSelectFilter — auto-submit on close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits the form when the dropdown closes after a selection change", async () => {
    const { submitSpy } = renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "ריתוך" }));
    // Close by clicking the trigger again
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT submit when the dropdown closes without any change", async () => {
    const { submitSpy } = renderInsideForm(["ct-1"]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    // close without ticking anything
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );

    // Give the effect a tick to run
    await new Promise((r) => setTimeout(r, 50));
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("closes the dropdown when ESC is pressed", async () => {
    renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("closes the dropdown on outside click", async () => {
    renderInsideForm([]);
    fireEvent.click(
      screen.getByRole("button", { name: /סינון לפי סוג הסמכה/ })
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});

describe("MultiSelectFilter — empty options", () => {
  it("shows a friendly empty-state inside the dropdown when no options exist", () => {
    render(
      <form>
        <MultiSelectFilter
          name="type"
          options={[]}
          selected={[]}
          placeholder="placeholder"
          ariaLabel="filter"
        />
      </form>
    );
    fireEvent.click(screen.getByRole("button", { name: /filter/ }));
    expect(screen.getByText(/אין אפשרויות/)).toBeInTheDocument();
  });
});
