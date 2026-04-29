import { CheckCircle } from "lucide-react";

export function ExpiringEmptyState() {
  return (
    <div
      className="rounded-xl p-10 text-center"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div
        className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-3"
        style={{ backgroundColor: "var(--success-light)" }}
      >
        <CheckCircle
          className="w-6 h-6"
          style={{ color: "var(--success)" }}
          aria-hidden="true"
        />
      </div>
      <p className="font-medium" style={{ color: "var(--foreground)" }}>
        הכל תקין
      </p>
      <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
        אין הסמכות שפג תוקפן או עומדות לפוג
      </p>
    </div>
  );
}
