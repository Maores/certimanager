import Link from "next/link";

export type CandidatesTabKey = "leads" | "candidates";

interface CandidatesTabsProps {
  activeTab: CandidatesTabKey;
  leadsCount: number;
  candidatesCount: number;
}

export function CandidatesTabs({
  activeTab,
  leadsCount,
  candidatesCount,
}: CandidatesTabsProps) {
  const tabs: { key: CandidatesTabKey; label: string; count: number }[] = [
    { key: "leads", label: "לידים", count: leadsCount },
    { key: "candidates", label: "מועמדים", count: candidatesCount },
  ];

  return (
    <div role="tablist" className="inline-flex rounded-lg border border-border bg-white p-1">
      {tabs.map((t) => {
        const isActive = t.key === activeTab;
        return (
          <Link
            key={t.key}
            role="tab"
            aria-selected={isActive}
            href={`/dashboard/candidates?tab=${t.key}`}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "bg-primary text-white"
                : "text-foreground hover:bg-gray-50"
            }`}
          >
            {t.label} ({t.count})
          </Link>
        );
      })}
    </div>
  );
}
