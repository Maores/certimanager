import Link from "next/link";
import { AlertTriangle, ChevronLeft } from "lucide-react";

interface AlertBannerProps {
  attentionCount: number;
  expiredCount: number;
  expiringSoonCount: number;
}

export function AlertBanner({
  attentionCount,
  expiredCount,
  expiringSoonCount,
}: AlertBannerProps) {
  if (attentionCount === 0) return null;

  const parts: string[] = [];
  if (expiredCount > 0) parts.push(`${expiredCount} פגות תוקף`);
  if (expiringSoonCount > 0) parts.push(`${expiringSoonCount} פגות בקרוב`);
  const subtitle = parts.join(" · ");

  const ariaLabel = subtitle
    ? `${attentionCount} הסמכות דורשות תשומת לב, ${subtitle}, לחץ לצפייה ברשימה`
    : `${attentionCount} הסמכות דורשות תשומת לב, לחץ לצפייה ברשימה`;

  return (
    <Link
      href="/dashboard/certifications?filter=attention"
      aria-label={ariaLabel}
      className="flex items-center gap-3 bg-danger-light border border-red-200 rounded-xl p-3.5 transition-colors hover:bg-red-100"
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 shrink-0">
        <AlertTriangle className="w-5 h-5 text-danger" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-danger">
          {attentionCount} הסמכות דורשות תשומת לב
        </p>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {/* ChevronLeft is the natural "forward" indicator in an RTL document. */}
      <ChevronLeft className="w-5 h-5 text-muted shrink-0" aria-hidden="true" />
    </Link>
  );
}
