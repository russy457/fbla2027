/**
 * clockDiscipline.test.ts
 * Guards SPEC 2.4 / SPEC#clock (G6): Functions take every timestamp from the
 * request clock. This scans functions/src and fails on
 * FieldValue.serverTimestamp, bare Date.now(), or argument-less new Date(),
 * which would bypass the demo clock and the injected test clock. It stands in
 * for the ESLint no-restricted-properties rule until the repo adopts ESLint.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
  });

const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
  ["serverTimestamp", /serverTimestamp/],
  ["Date.now()", /\bDate\.now\s*\(/],
  ["new Date() without an argument", /new Date\(\s*\)/]
];

/** Strips comments so documentation that names the forbidden calls does not trip the check. */
const withoutComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("functions/src clock discipline (SPEC#clock)", () => {
  it("finds the source files", () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(20);
  });

  it.each(FORBIDDEN)("never uses %s", (_label, pattern) => {
    const offenders = sourceFiles(SRC)
      .filter((file) => pattern.test(withoutComments(readFileSync(file, "utf8"))))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
