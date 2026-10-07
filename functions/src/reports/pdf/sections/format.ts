/**
 * format.ts
 * Number formatting shared by the report sections (SPEC 8.6): hours with two
 * decimals from minutes, and percentages.
 */
import { minutesToHours } from "@fbla/shared";

export const hoursText = (minutes: number): string => minutesToHours(minutes).toFixed(2);

export const percentText = (ratio: number | null): string => (ratio === null ? "Not yet" : `${Math.round(ratio * 100)}%`);
