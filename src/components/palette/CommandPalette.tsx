/**
 * CommandPalette.tsx
 * The Ctrl/Cmd+K palette dialog (SPEC 9.1, navigation rubric row). A modal
 * dialog holding one search field that follows the ARIA combobox pattern:
 *
 *   the input     role=combobox, owns the listbox through aria-controls, and
 *                 points at the highlighted option with aria-activedescendant,
 *                 so focus never leaves the text field while arrowing
 *   the listbox   options grouped as Pages, Shifts, Organizations, Help
 *   keys          Up/Down move (wrapping), Home/End jump, Enter opens,
 *                 Esc closes, Tab stays inside the dialog (focus trap)
 *   live region   announces how many results there are as you type
 *
 * The opener (CommandPaletteLauncher) owns open state, data, and focus
 * restore; this component only renders and reports the chosen item.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { ArrowRight, Buildings, CalendarCheck, Compass, MagnifyingGlass, Question, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useFocusTrap } from "@/components/help/useFocusTrap";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { cn } from "@/lib/cn";
import {
  buildPaletteGroups,
  flattenGroups,
  type PaletteArticle,
  type PaletteGroupId,
  type PaletteItem,
  type PaletteOrg
} from "@/lib/palette/paletteCommands";

const GROUP_ICONS: Readonly<Record<PaletteGroupId, Icon>> = {
  pages: Compass,
  shifts: CalendarCheck,
  organizations: Buildings,
  help: Question
};

export interface PaletteSources {
  readonly routes: readonly PaletteItem[];
  /** BM25 help hits for a typed query, or suggestions for this page when the query is empty. */
  readonly articlesFor: (query: string) => readonly PaletteArticle[];
  readonly orgs: readonly PaletteOrg[];
}

interface CommandPaletteProps {
  readonly sources: PaletteSources;
  readonly onSelect: (item: PaletteItem) => void;
  readonly onClose: () => void;
}

const resultsSentence = (count: number, query: string): string => {
  if (count === 0) return query.trim() === "" ? "Type to search." : `No results for "${query.trim()}".`;
  return count === 1 ? "1 result." : `${count} results.`;
};

export const CommandPalette = ({ sources, onSelect, onClose }: CommandPaletteProps): ReactElement => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const listId = `${idPrefix}-list`;
  const optionId = (index: number): string => `${idPrefix}-option-${index}`;
  useFocusTrap({ containerRef: dialogRef, initialFocusRef: inputRef, onEscape: onClose });

  const { articlesFor, orgs, routes } = sources;
  const groups = useMemo(() => buildPaletteGroups({ query, routes, articles: articlesFor(query), orgs }), [query, routes, articlesFor, orgs]);
  const items = useMemo(() => flattenGroups(groups), [groups]);
  const active = items[activeIndex];

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    const option = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    option?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  const move = (next: number): void => {
    if (items.length === 0) return;
    setActiveIndex((next + items.length) % items.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const keyMoves: Record<string, () => void> = {
      ArrowDown: () => move(activeIndex + 1),
      ArrowUp: () => move(activeIndex - 1),
      Home: () => move(0),
      End: () => move(items.length - 1),
      Enter: () => {
        if (active) onSelect(active);
      }
    };
    const action = keyMoves[event.key];
    // Home/End keep their caret meaning while there is nothing to move through.
    if (!action || (items.length === 0 && event.key !== "Enter")) return;
    event.preventDefault();
    action();
  };

  // Index of each group's first option in the flat list (the arrow-key index space).
  const groupStarts = groups.map((_, groupIndex) => groups.slice(0, groupIndex).reduce((sum, group) => sum + group.items.length, 0));
  return (
    <div className="fixed inset-0 z-(--z-overlay) flex items-start justify-center px-4 pt-[10vh]">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-fg/40" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-command-palette=""
        className="relative flex max-h-[80vh] w-full max-w-xl flex-col overflow-y-auto overscroll-contain rounded-lg border border-border bg-surface shadow-lg transition-[opacity,transform] duration-(--duration-fast) ease-out starting:-translate-y-2 starting:opacity-0"
      >
        {/* The whole dialog scrolls (it holds the focusable field, so keyboard users can always scroll), with the field pinned on top. */}
        <h2 id={titleId} className="sr-only">
          Search and jump
        </h2>
        <div className="sticky top-0 z-(--z-header) flex items-center gap-2 border-b-2 border-border bg-surface px-4 focus-within:border-accent">
          <MagnifyingGlass aria-hidden="true" size={20} className="shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Search pages, shifts, organizations, and help"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active ? optionId(activeIndex) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              // A new query starts the highlight at the top result again.
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to a page"
            className="min-h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className={buttonClassName("quiet", "shrink-0 px-0")}>
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          hidden={items.length === 0}
          className="flex-1 p-2"
        >
          {groups.map((group, groupIndex) => {
            const GroupIcon = GROUP_ICONS[group.id];
            const groupLabelId = `${idPrefix}-group-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={groupLabelId} className="pb-2">
                <div id={groupLabelId} role="presentation" className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">
                  {group.label}
                </div>
                {group.items.map((item, itemIndex) => {
                  const index = (groupStarts[groupIndex] ?? 0) + itemIndex;
                  const isActive = index === activeIndex;
                  return (
                    <div
                      key={item.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isActive}
                      data-index={index}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => onSelect(item)}
                      className={cn(
                        "flex min-h-touch scroll-my-16 cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors duration-(--duration-instant)",
                        isActive ? "bg-accent-subtle text-fg" : "text-fg"
                      )}
                    >
                      <GroupIcon aria-hidden="true" size={18} className={cn("shrink-0", isActive ? "text-accent" : "text-fg-muted")} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.label}</span>
                        <span className="truncate text-sm text-fg-muted">{item.hint}</span>
                      </span>
                      {isActive ? <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-accent" /> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {items.length === 0 ? <p className="px-3 py-8 text-center text-sm text-fg-muted">{resultsSentence(0, query)}</p> : null}

        <p aria-live="polite" className="sr-only">
          {resultsSentence(items.length, query)}
        </p>
        <p aria-hidden="true" className="hidden gap-4 border-t border-border px-4 py-2 text-xs text-fg-muted sm:flex">
          <span>
            <kbd className="font-mono">Up</kbd>/<kbd className="font-mono">Down</kbd> to move
          </span>
          <span>
            <kbd className="font-mono">Enter</kbd> to open
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> to close
          </span>
        </p>
      </div>
    </div>
  );
};
