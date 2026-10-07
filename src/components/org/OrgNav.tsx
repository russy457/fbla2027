/**
 * OrgNav.tsx
 * Coordinator navigation under /org/:orgId/* (SPEC#screen-nav D2): Dashboard,
 * Shifts, Reports, Settings. A vertical side nav on desktop (>= 1024 px) and
 * a row of tabs on smaller screens. The org switcher (a labeled select) shows
 * only when the person coordinates two or more organizations.
 */
import type { ReactElement } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CalendarBlank, ChartBar, GearSix, House, Stack, type Icon } from "@phosphor-icons/react";
import { useMyMemberships } from "@/hooks/useMemberships";
import { cn } from "@/lib/cn";
import { useSessionUser } from "@/store/authStore";
import { INPUT_CLASSES } from "@/components/ui/TextField";

interface OrgNavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: Icon;
}

const ITEMS: readonly OrgNavItem[] = [
  { path: "dashboard", label: "Dashboard", icon: House },
  { path: "shifts", label: "Shifts", icon: CalendarBlank },
  { path: "reports", label: "Reports", icon: ChartBar },
  // Tier 2 lane B
  { path: "collections", label: "Collections", icon: Stack },
  { path: "settings", label: "Settings", icon: GearSix }
];

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    "inline-flex min-h-touch items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-(--duration-fast)",
    isActive ? "bg-accent-subtle text-accent" : "text-fg-muted hover:bg-surface-sunken hover:text-fg"
  );

const OrgSwitcher = ({ orgId }: { orgId: string }): ReactElement | null => {
  const user = useSessionUser();
  const memberships = useMyMemberships(user?.uid ?? null);
  const navigate = useNavigate();
  const orgs = memberships.data ?? [];
  if (orgs.length < 2) return null;
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-fg">
      Organization
      <select value={orgId} onChange={(event) => navigate(`/org/${event.target.value}/dashboard`)} className={INPUT_CLASSES}>
        {orgs.map((org) => (
          <option key={org.orgId} value={org.orgId}>
            {org.orgName}
          </option>
        ))}
      </select>
    </label>
  );
};

export const OrgNav = ({ orgId }: { orgId: string }): ReactElement => (
  <div className="flex flex-col gap-3 lg:w-52 lg:shrink-0">
    <OrgSwitcher orgId={orgId} />
    <nav aria-label="Organization">
      <ul className="flex gap-1 overflow-x-auto border-b border-border pb-2 lg:flex-col lg:border-b-0 lg:pb-0">
        {ITEMS.map(({ path, label, icon: ItemIcon }) => (
          <li key={path}>
            <NavLink to={`/org/${orgId}/${path}`} end={path !== "shifts"} className={linkClass}>
              <ItemIcon aria-hidden="true" size={18} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  </div>
);
