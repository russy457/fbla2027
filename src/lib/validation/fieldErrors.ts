/**
 * fieldErrors.ts
 * Turns a zod failure into one message per top-level form field ("address"
 * covers address.city too), so a form can show the error next to the field.
 * The server re-validates with the same shared schema (SPEC 5.1).
 */
import type { z } from "zod";

export type FieldErrors = Readonly<Record<string, string>>;

export const fieldErrorsOf = (error: z.ZodError): FieldErrors =>
  error.issues.reduce<Record<string, string>>((errors, issue) => {
    const key = issue.path.map(String).join(".") || "form";
    return key in errors ? errors : { ...errors, [key]: issue.message };
  }, {});
