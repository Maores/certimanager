import Link from "next/link";
import { Plus, Search, FileUp } from "lucide-react";
import type { ElementType } from "react";
import {
  MobileExpiringList,
  type ExpiringRow,
} from "./mobile-expiring-list";

interface TileProps {
  href: string;
  icon: ElementType;
  label: string;
  primary?: boolean;
  fullWidth?: boolean;
}

function Tile({ href, icon, label, primary = false, fullWidth = false }: TileProps) {
  const Icon = icon;
  const base = "p-4 rounded-xl flex flex-col justify-between gap-4";
  const shape = fullWidth ? "col-span-2 py-5" : "aspect-square";
  const skin = primary
    ? "bg-primary text-white"
    : "bg-card border border-border";

  return (
    <Link
      href={href}
      className={`${base} ${shape} ${skin}`}
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-lg ${
          primary ? "bg-white/20" : "bg-primary-light"
        }`}
      >
        <Icon
          className={`w-5 h-5 ${primary ? "" : "text-primary"}`}
          aria-hidden="true"
        />
      </div>
      <p className={`font-semibold ${primary ? "" : "text-foreground"}`}>
        {label}
      </p>
    </Link>
  );
}

interface MobileDashboardHeroProps {
  expiringList: ExpiringRow[];
  isGuest: boolean;
}

export function MobileDashboardHero({
  expiringList,
  isGuest,
}: MobileDashboardHeroProps) {
  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-2 gap-3"
        data-testid="mobile-quick-actions-grid"
      >
        <Tile
          href="/dashboard/certifications/new"
          icon={Plus}
          label="הוסף הסמכה"
          primary
        />
        <Tile href="/dashboard/employees" icon={Search} label="חפש עובד" />
        <Tile
          href="/dashboard/employees/new"
          icon={Plus}
          label="הוסף עובד"
          fullWidth={isGuest}
        />
        {!isGuest && (
          <Tile
            href="/dashboard/import"
            icon={FileUp}
            label="ייבוא Excel"
          />
        )}
      </div>

      <section>
        <h2 className="text-base font-semibold mb-3 text-foreground">
          פג תוקף בקרוב
        </h2>
        <MobileExpiringList expiringList={expiringList} />
      </section>
    </div>
  );
}
