/**
 * seedSummary.ts
 * What the seed prints when it finishes (SPEC#demo step 4): the credentials
 * table and localhost links. Every link is a route that exists in
 * src/router.tsx; demoSeed.test.ts checks that, so a renamed route cannot
 * leave the demo printing a dead link again.
 */
import { formatClockTime } from "@fbla/shared";
import type { DemoAccount } from "./demoCast";
import { ORGS } from "./demoCast";
import { DEMO_INSTANCE_ID } from "./demoSeed";
import { SEED_TIME_ZONE } from "./seedBuilders";

export interface DemoLink {
  readonly label: string;
  readonly path: string;
}

/** App paths the demo walks through, in presentation order. */
export const demoLinks = (letterVerifyCode: string): readonly DemoLink[] => [
  { label: "Explore", path: "/explore" },
  { label: "Shift page", path: `/opportunity/${DEMO_INSTANCE_ID}` },
  { label: "My Shifts", path: "/me/shifts" },
  { label: "Impact and letters", path: "/impact" },
  { label: "Coordinator", path: `/org/${ORGS.pantry.id}/dashboard` },
  { label: "Kiosk", path: `/org/${ORGS.pantry.id}/kiosk/${DEMO_INSTANCE_ID}` },
  { label: "Admin", path: "/admin" },
  { label: "Past letter", path: `/verify/${letterVerifyCode}` }
];

export interface SummaryInput {
  readonly projectId: string;
  readonly accounts: readonly DemoAccount[];
  readonly password: string;
  readonly appUrl: string;
  readonly emulatorUiUrl: string;
  readonly demoShiftStartMs: number;
  readonly shiftStartsInMs: number;
  readonly letterVerifyCode: string;
  readonly letterPdfStatus: string;
}

const table = (rows: readonly (readonly string[])[]): string => {
  const widths = (rows[0] ?? []).map((_cell, column) => Math.max(...rows.map((row) => (row[column] ?? "").length)));
  return rows.map((row) => `  ${row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join("   ")}`.trimEnd()).join("\n");
};

export const formatSeedSummary = (input: SummaryInput): string => {
  const header = ["Role", "Email", "Password"];
  const rows = input.accounts.map((account) => [account.role, account.email, input.password]);
  const rule = header.map((_cell, column) => "-".repeat(Math.max(...[header, ...rows].map((row) => (row[column] ?? "").length))));
  const minutes = Math.round(input.shiftStartsInMs / 60_000);
  const links = [...demoLinks(input.letterVerifyCode).map((link) => [link.label, `${input.appUrl}${link.path}`]), ["Emulator UI", input.emulatorUiUrl]];
  return [
    `seed: demo data ready in project ${input.projectId} (emulators only; the password works nowhere else).`,
    "",
    table([header, rule, ...rows]),
    "",
    `  Shift "Sort and pack food boxes" starts at ${formatClockTime(new Date(input.demoShiftStartMs), SEED_TIME_ZONE)} (in ${minutes} min): 3 seats, 1 left; Jordan is signed up.`,
    "  Jordan has 22.5 approved hours, so checking out of that shift crosses the 25-hour milestone.",
    `  Seeded letter PDF: ${input.letterPdfStatus}.`,
    "",
    table(links),
    ""
  ].join("\n");
};
