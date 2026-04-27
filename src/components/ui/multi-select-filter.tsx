"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  /** Form field name. The submitted value is the selected values joined by ",". */
  name: string;
  options: MultiSelectOption[];
  /** Initially selected values (from the URL params on first render). */
  selected: string[];
  /** Shown on the trigger button when nothing is selected. */
  placeholder: string;
  /** Accessible name on the trigger button. */
  ariaLabel: string;
  /** Optional Tailwind classes applied to the outer wrapper. */
  className?: string;
}

/**
 * Multi-select filter with chip/checkbox UI. Replaces a single-select dropdown
 * inside a GET form. The submitted form field is a comma-separated string of
 * the selected option values, so the URL contract (`?name=A,B,C`) is backward
 * compatible with single-value links (`?name=A`).
 *
 * Auto-submits the parent form when the dropdown closes IF the selection
 * actually changed since the last submit. Avoids submitting on every checkbox
 * tick (visual jank when the user wants to pick several at once).
 */
export function MultiSelectFilter({
  name,
  options,
  selected: initialSelected,
  placeholder,
  ariaLabel,
  className,
}: MultiSelectFilterProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected)
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSubmittedRef = useRef<string>(initialSelected.join(","));

  // Close on outside click + ESC.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-submit when dropdown closes IF selection changed since last submit.
  useEffect(() => {
    if (open) return;
    const current = Array.from(selected).join(",");
    if (current !== lastSubmittedRef.current) {
      lastSubmittedRef.current = current;
      const form = containerRef.current?.closest("form");
      if (form) form.submit();
    }
  }, [open, selected]);

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  let triggerLabel: string;
  if (selected.size === 0) {
    triggerLabel = placeholder;
  } else if (selected.size === 1) {
    const onlyValue = selected.values().next().value as string;
    triggerLabel =
      options.find((o) => o.value === onlyValue)?.label ?? placeholder;
  } else {
    triggerLabel = `${selected.size} נבחרו`;
  }

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <input
        type="hidden"
        name={name}
        value={Array.from(selected).join(",")}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="inline-flex w-full min-h-[44px] select-none items-center justify-between gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer"
      >
        <span
          className={
            selected.size === 0 ? "text-muted-foreground truncate" : "truncate"
          }
        >
          {triggerLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-white shadow-lg"
        >
          {/*
            Always render the "נקה הכל" slot so the checkbox rows below it
            don't shift up/down by ~32px every time the selection count
            crosses 0/1. Disabled-styled when nothing is selected.
          */}
          <button
            type="button"
            onClick={clearAll}
            disabled={selected.size === 0}
            aria-disabled={selected.size === 0}
            className={`w-full select-none text-right px-4 py-2 text-xs border-b border-border ${
              selected.size === 0
                ? "text-muted-foreground/50 cursor-default"
                : "text-muted-foreground hover:bg-gray-50 cursor-pointer"
            }`}
          >
            נקה הכל
          </button>
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              אין אפשרויות
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = selected.has(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex min-h-[44px] cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(opt.value)}
                    aria-label={opt.label}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                  />
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && (
                    <Check
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
