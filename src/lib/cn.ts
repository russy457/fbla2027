/**
 * cn.ts
 * Joins class names (clsx) and resolves conflicting Tailwind utilities so the
 * last one wins (tailwind-merge). Ported from the old app; also the shadcn
 * "utils" alias in components.json.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
