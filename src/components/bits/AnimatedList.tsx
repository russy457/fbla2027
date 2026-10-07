/**
 * AnimatedList.tsx
 * Scrollable list whose rows scale in as they enter view, with keyboard
 * selection. Plan D15: use only for live roster arrivals and notifications.
 *
 * Source: https://reactbits.dev/r/AnimatedList-TS-TW.json (React Bits, https://github.com/DavidHDev/react-bits)
 * Vendored: 2026-10-06
 * License: MIT + Commons Clause (React Bits). The components may not be sold on their own.
 * Local edits:
 *  - Colors, radius, scrollbar, and edge fades use design tokens (no hex).
 *  - Accessibility: upstream listened for keys on the whole window and hijacked
 *    Tab, which trapped keyboard users. Keys are now handled only while the list
 *    has focus, Tab is never intercepted, and rows expose listbox/option roles.
 *  - Reduced motion: rows render without the scale animation.
 *  - Removed the "Item 1..15" demo defaults and the fixed 500px width.
 *  - Optional renderItem so callers can show rich rows (roster arrivals).
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
  type UIEvent
} from "react";
import { motion, useInView } from "motion/react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { cn } from "@/lib/cn";

const EDGE_FADE_DISTANCE_PX = 50;
const SCROLL_MARGIN_PX = 50;

interface AnimatedItemProps {
  children: ReactNode;
  delay?: number;
  index: number;
  id: string;
  isSelected: boolean;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const AnimatedItem = ({ children, delay = 0, index, id, isSelected, onMouseEnter, onClick }: AnimatedItemProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: false });
  const reduceMotion = useReducedMotionPreference();
  const visible = reduceMotion || inView;
  return (
    <motion.div
      ref={ref}
      id={id}
      role="option"
      aria-selected={isSelected}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
      animate={visible ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, delay }}
      className="mb-3 cursor-pointer"
    >
      {children}
    </motion.div>
  );
};

interface AnimatedListProps<T> {
  items: readonly T[];
  /** Accessible name for the list (required: it is a focusable listbox). */
  label: string;
  onItemSelect?: (item: T, index: number) => void;
  renderItem?: (item: T, index: number, isSelected: boolean) => ReactNode;
  getKey?: (item: T, index: number) => string;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  itemClassName?: string;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
}

function AnimatedList<T>({
  items,
  label,
  onItemSelect,
  renderItem,
  getKey = (_item, index) => String(index),
  showGradients = true,
  enableArrowNavigation = true,
  className = "",
  itemClassName = "",
  displayScrollbar = true,
  initialSelectedIndex = -1
}: AnimatedListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      setSelectedIndex(index);
      if (item !== undefined) onItemSelect?.(item, index);
    },
    [items, onItemSelect]
  );

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    setTopGradientOpacity(Math.min(scrollTop / EDGE_FADE_DISTANCE_PX, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / EDGE_FADE_DISTANCE_PX, 1));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enableArrowNavigation || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setKeyboardNav(true);
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setKeyboardNav(true);
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter" && selectedIndex >= 0 && selectedIndex < items.length) {
      event.preventDefault();
      selectItem(selectedIndex);
    }
  };

  useEffect(() => {
    if (!keyboardNav || selectedIndex < 0 || !listRef.current) return;
    const container = listRef.current;
    const selected = container.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (selected) {
      const itemTop = selected.offsetTop;
      const itemBottom = itemTop + selected.offsetHeight;
      if (itemTop < container.scrollTop + SCROLL_MARGIN_PX) {
        container.scrollTo({ top: itemTop - SCROLL_MARGIN_PX });
      } else if (itemBottom > container.scrollTop + container.clientHeight - SCROLL_MARGIN_PX) {
        container.scrollTo({ top: itemBottom - container.clientHeight + SCROLL_MARGIN_PX });
      }
    }
    setKeyboardNav(false);
  }, [selectedIndex, keyboardNav]);

  const optionId = (index: number) => `${idPrefix}-option-${index}`;

  return (
    <div className={cn("relative w-full", className)}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        aria-activedescendant={selectedIndex >= 0 ? optionId(selectedIndex) : undefined}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className={cn(
          "max-h-[400px] overflow-y-auto rounded-lg p-3",
          displayScrollbar ? "[scrollbar-width:thin]" : "[scrollbar-width:none]"
        )}
      >
        {items.map((item, index) => {
          const isSelected = selectedIndex === index;
          return (
            <AnimatedItem
              key={getKey(item, index)}
              id={optionId(index)}
              delay={0.1}
              index={index}
              isSelected={isSelected}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectItem(index)}
            >
              <div
                className={cn(
                  "rounded-md border border-border bg-surface p-4 text-fg transition-colors duration-(--duration-fast)",
                  isSelected && "border-accent bg-accent-subtle",
                  itemClassName
                )}
              >
                {renderItem ? renderItem(item, index, isSelected) : <p className="m-0">{String(item)}</p>}
              </div>
            </AnimatedItem>
          );
        })}
      </div>
      {showGradients && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 left-0 h-[50px] bg-linear-to-b from-bg to-transparent transition-opacity duration-(--duration-base)"
            style={{ opacity: topGradientOpacity }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-0 left-0 h-[100px] bg-linear-to-t from-bg to-transparent transition-opacity duration-(--duration-base)"
            style={{ opacity: bottomGradientOpacity }}
          />
        </>
      )}
    </div>
  );
}

export default AnimatedList;
