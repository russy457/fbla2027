/**
 * CollectionRows.tsx
 * The items of a curated collection as a list (collection page, SPEC 9.1
 * "/collections/:id"): shifts link to their next date, organizations to their
 * public page, with the Unverified chip where it applies (D23). Items whose
 * target is gone say so and are not linked. Rows come from
 * resolveCollectionItems, so this component only renders.
 */
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Buildings, CalendarBlank } from "@phosphor-icons/react";
import { formatShiftTime } from "@fbla/shared";
import { OrgLink } from "@/components/ui/OrgLink";
import { UnverifiedChip } from "@/components/ui/UnverifiedChip";
import type { CollectionRow } from "@/lib/collectionItems";

const LINK_CLASS = "font-semibold text-fg underline-offset-4 hover:text-accent hover:underline focus-visible:underline";

const Row = ({ row }: { row: CollectionRow }): ReactElement => {
  const KindIcon = row.kind === "org" ? Buildings : CalendarBlank;
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-4">
      <KindIcon aria-hidden="true" size={20} className="mt-0.5 text-fg-subtle" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="sr-only">{row.kind === "org" ? "Organization: " : "Shift: "}</span>
          {row.href ? (
            <Link to={row.href} className={LINK_CLASS}>
              {row.title}
            </Link>
          ) : (
            <span className={row.missing ? "text-fg-muted" : "font-semibold text-fg"}>{row.title}</span>
          )}
          {!row.missing && !row.verified ? <UnverifiedChip /> : null}
        </p>
        {row.kind === "opportunity" && row.orgId && row.orgName ? (
          <p className="text-sm text-fg-muted">
            <OrgLink orgId={row.orgId} name={row.orgName} />
          </p>
        ) : null}
        {row.detail ? <p className="line-clamp-2 max-w-[65ch] text-sm text-fg-muted">{row.detail}</p> : null}
        {row.kind === "opportunity" && !row.missing ? (
          row.next ? (
            <p className="font-mono text-sm text-fg">Next: {formatShiftTime(new Date(row.next.startMs), row.next.timeZone)}</p>
          ) : (
            <p className="text-sm text-fg-muted">No upcoming shifts right now.</p>
          )
        ) : null}
      </div>
    </li>
  );
};

export const CollectionRows = ({ rows }: { rows: readonly CollectionRow[] }): ReactElement =>
  rows.length === 0 ? (
    <p className="text-fg-muted">This collection is empty.</p>
  ) : (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <Row key={row.key} row={row} />
      ))}
    </ul>
  );
