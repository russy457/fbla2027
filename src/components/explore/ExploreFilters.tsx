/**
 * ExploreFilters.tsx
 * Search box and smart filters for Explore (SPEC 8.5, SPEC 9.2 "search +
 * filters"; Clear filters per D6). Controlled by the URL: every change
 * writes the filters back to the search params (filters.ts), so a filtered
 * view can be shared and the back button undoes a change. Native inputs in
 * a fieldset, each with a visible label, so it all works by keyboard and
 * screen reader. The result count is announced politely.
 */
import { useId, useState, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { CAUSE_AREAS, TIME_BLOCKS, WEEKDAY_KEYS } from "@fbla/shared";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { CAUSE_AREA_LABELS } from "@/lib/causeAreas";
import { DISTANCE_OPTIONS_MILES, EMPTY_FILTERS, OPPORTUNITY_TYPES, activeFilterCount, type ExploreFilters as Filters } from "@/lib/explore/filters";

interface ExploreFiltersProps {
  readonly filters: Filters;
  readonly onChange: (filters: Filters) => void;
  readonly resultCount: number;
  readonly signedIn: boolean;
  /** Distance needs the volunteer's ZIP area. */
  readonly canUseDistance: boolean;
  /** Name of the organization filter, when one is set from Saved. */
  readonly orgName: string | null;
}

const DAY_LABELS: Readonly<Record<(typeof WEEKDAY_KEYS)[number], string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};
const BLOCK_LABELS: Readonly<Record<(typeof TIME_BLOCKS)[number], string>> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const TYPE_LABELS: Readonly<Record<(typeof OPPORTUNITY_TYPES)[number], string>> = {
  "one-time": "One-time",
  recurring: "Recurring",
  virtual: "Virtual",
  skilled: "Skilled"
};

const fieldClass =
  "min-h-touch w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus";

const Field = ({ id, label, children }: { id: string; label: string; children: ReactNode }): ReactElement => (
  <div className="flex min-w-0 flex-col gap-1">
    <label htmlFor={id} className="text-sm font-medium text-fg">
      {label}
    </label>
    {children}
  </div>
);

const Check = ({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: string }): ReactElement => (
  <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 text-sm text-fg">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-(--accent)" />
    {children}
  </label>
);

export const ExploreFilters = ({ filters, onChange, resultCount, signedIn, canUseDistance, orgName }: ExploreFiltersProps): ReactElement => {
  const id = useId();
  const count = activeFilterCount({ ...filters, q: "" });
  const [isOpen, setIsOpen] = useState(count > 0);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]): void => onChange({ ...filters, [key]: value });
  const select = <K extends keyof Filters>(key: K) => (event: ChangeEvent<HTMLSelectElement>) =>
    set(key, (event.target.value === "" ? null : event.target.value) as Filters[K]);

  return (
    <section aria-label="Search and filters" className="flex flex-col gap-4">
      <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${id}-q`} className="text-sm font-medium text-fg">
            Search shifts
          </label>
          <div className="relative">
            <MagnifyingGlass aria-hidden="true" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
            <input
              id={`${id}-q`}
              type="search"
              value={filters.q}
              onChange={(event) => set("q", event.target.value)}
              placeholder="Food bank, tutoring, Spanish..."
              className={`${fieldClass} pl-9`}
            />
          </div>
        </div>
        <button type="button" aria-expanded={isOpen} aria-controls={`${id}-panel`} onClick={() => setIsOpen((open) => !open)} className={buttonClassName("secondary")}>
          <Funnel aria-hidden="true" size={18} />
          {count > 0 ? `Filters (${count})` : "Filters"}
        </button>
      </form>

      {orgName ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
          Showing shifts from <strong>{orgName}</strong>
          <button type="button" onClick={() => set("org", null)} className={buttonClassName("quiet")}>
            <X aria-hidden="true" size={16} />
            Show all organizations
          </button>
        </p>
      ) : null}

      {isOpen ? (
        <fieldset id={`${id}-panel`} className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="px-1 text-sm font-semibold text-fg">Filters</legend>
          <Field id={`${id}-cause`} label="Cause">
            <select id={`${id}-cause`} value={filters.cause ?? ""} onChange={select("cause")} className={fieldClass}>
              <option value="">Any cause</option>
              {CAUSE_AREAS.map((cause) => (
                <option key={cause} value={cause}>
                  {CAUSE_AREA_LABELS[cause]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-type`} label="Type">
            <select id={`${id}-type`} value={filters.type ?? ""} onChange={select("type")} className={fieldClass}>
              <option value="">Any type</option>
              {OPPORTUNITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-day`} label="Day of the week">
            <select id={`${id}-day`} value={filters.day ?? ""} onChange={select("day")} className={fieldClass}>
              <option value="">Any day</option>
              {WEEKDAY_KEYS.map((day) => (
                <option key={day} value={day}>
                  {DAY_LABELS[day]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-block`} label="Time of day">
            <select id={`${id}-block`} value={filters.block ?? ""} onChange={select("block")} className={fieldClass}>
              <option value="">Any time</option>
              {TIME_BLOCKS.map((block) => (
                <option key={block} value={block}>
                  {BLOCK_LABELS[block]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-from`} label="From date">
            <input id={`${id}-from`} type="date" value={filters.from ?? ""} onChange={(event) => set("from", event.target.value || null)} className={fieldClass} />
          </Field>
          <Field id={`${id}-to`} label="To date">
            <input id={`${id}-to`} type="date" value={filters.to ?? ""} onChange={(event) => set("to", event.target.value || null)} className={fieldClass} />
          </Field>
          <Field id={`${id}-within`} label="Distance">
            <select
              id={`${id}-within`}
              value={filters.within ?? ""}
              disabled={!canUseDistance}
              aria-describedby={canUseDistance ? undefined : `${id}-within-hint`}
              onChange={(event) => set("within", event.target.value === "" ? null : (Number(event.target.value) as Filters["within"]))}
              className={fieldClass}
            >
              <option value="">Any distance</option>
              {DISTANCE_OPTIONS_MILES.map((miles) => (
                <option key={miles} value={miles}>
                  Within {miles} miles
                </option>
              ))}
            </select>
            {canUseDistance ? null : (
              <span id={`${id}-within-hint`} className="text-xs text-fg-muted">
                <Link to="/me/profile#zip" className="font-semibold text-accent underline underline-offset-2">
                  Add your ZIP code
                </Link>{" "}
                to your profile to filter by distance.
              </span>
            )}
          </Field>
          <div className="flex flex-col justify-end gap-0">
            <Check checked={filters.seats} onChange={(value) => set("seats", value)}>
              Seats available
            </Check>
            {signedIn ? (
              <Check checked={filters.eligible} onChange={(value) => set("eligible", value)}>
                Eligible for my age
              </Check>
            ) : null}
            <Check checked={filters.verified} onChange={(value) => set("verified", value)}>
              Verified organizations only
            </Check>
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="text-sm text-fg-muted">
          {resultCount === 1 ? "1 shift" : `${resultCount} shifts`}
        </p>
        {activeFilterCount(filters) > 0 ? (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className={buttonClassName("quiet")}>
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
};
