/**
 * navItems.ts
 * The four volunteer destinations (plan D2). The adaptive top nav keeps these
 * routes in the same order before and after it contracts to an icon pill.
 * Coordinator, kiosk, and admin routes are reached by role, not these links.
 */
import type { Icon } from "@phosphor-icons/react";
import { CalendarCheck, Compass, HandHeart, Question } from "@phosphor-icons/react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: Icon;
  /** Only an exact URL match counts as active. */
  readonly end: boolean;
}

export const VOLUNTEER_NAV_ITEMS: readonly NavItem[] = Object.freeze([
  { to: "/explore", label: "Explore", icon: Compass, end: true },
  { to: "/me/shifts", label: "My Shifts", icon: CalendarCheck, end: false },
  { to: "/impact", label: "Impact", icon: HandHeart, end: false },
  { to: "/help", label: "Help", icon: Question, end: false }
]);
