#!/usr/bin/env node
/**
 * check-tokens.mjs
 * Fails when a hardcoded color appears in component code (plan item "React
 * Bits vendoring", D14). Every color must come from src/styles/tokens.css via
 * a Tailwind utility or var(--token). Scans src/components (including
 * src/components/bits) for hex colors (#abc, #aabbcc, #aabbccdd) and numeric
 * rgb()/rgba()/hsl()/hsla() literals.
 *
 * Usage: node scripts/check-tokens.mjs   (exit 1 when anything is found)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = [join(ROOT, "src", "components")];
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".js", ".jsx"]);

const HEX_COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?)\(\s*\d/g;

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listFiles(path);
    const dot = name.lastIndexOf(".");
    return dot >= 0 && EXTENSIONS.has(name.slice(dot)) ? [path] : [];
  });

const findings = SCAN_DIRS.flatMap(listFiles).flatMap((file) =>
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) =>
      [...line.matchAll(HEX_COLOR), ...line.matchAll(FUNCTIONAL_COLOR)].map((match) => ({
        file: relative(ROOT, file),
        line: index + 1,
        value: match[0]
      }))
    )
);

if (findings.length > 0) {
  console.error("check:tokens failed: hardcoded colors found in component code.");
  for (const { file, line, value } of findings) console.error(`  ${file}:${line}  ${value}`);
  console.error("Fix: use a token utility (bg-surface, text-fg, text-status-success...) or var(--token) from src/styles/tokens.css.");
  process.exit(1);
}

console.log(`check:tokens: no hardcoded colors in ${SCAN_DIRS.map((dir) => relative(ROOT, dir)).join(", ")}`);
