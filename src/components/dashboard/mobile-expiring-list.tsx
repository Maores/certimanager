import { formatDateHe } from "@/types/database";
import { ExpiringEmptyState } from "./expiring-empty-state";

export interface ExpiringRow {
  employee: string;
  cert: string;
  expires: string;
  status: "expired" | "expiring_soon";
}

interface MobileExpiringListProps {
  expiringList: ExpiringRow[];
}

export function MobileExpiringList({ expiringList }: MobileExpiringListProps) {
  if (expiringList.length === 0) {
    return <ExpiringEmptyState />;
  }

  return (
    <div
      className="rounded-xl overflow-hidden bg-card border border-border"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <ul className="divide-y divide-border-light">
        {expiringList.map((row, i) => (
          <li
            key={i}
            className="p-4 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">
                {row.employee}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {row.cert} ·{" "}
                <span className="ltr-nums">{formatDateHe(row.expires)}</span>
              </p>
            </div>
            {row.status === "expired" ? (
              <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-danger-light text-danger">
                פג תוקף
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning-light text-warning">
                פג בקרוב
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
