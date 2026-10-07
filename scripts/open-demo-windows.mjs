#!/usr/bin/env node
/**
 * Opens the four independent local demo roles in Chrome browser contexts.
 * All contexts use the emulator-only sign-in buttons, so no password or
 * cloud account is stored in this script. One laptop counts as one device.
 *
 * Usage: npm run demo:windows [-- --url=http://localhost:5173]
 *        npm run demo:windows -- --headless --url=http://localhost:5173
 */
import { chromium } from "@playwright/test";

const rawUrl = process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ?? "http://localhost:5173";
const baseUrl = new URL(rawUrl);
if (baseUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error("Demo windows may connect only to a local HTTP server.");
}

const windows = [
  { label: "Coordinator", role: "Coordinator", path: "/org/common-table-pantry/dashboard", width: 1280, height: 800 },
  { label: "Kiosk setup", role: "Coordinator", path: "/org/common-table-pantry/dashboard", width: 1100, height: 800 },
  { label: "Volunteer", role: "Volunteer (19)", path: "/explore", width: 390, height: 844 },
  { label: "Admin", role: "Admin", path: "/admin", width: 980, height: 720 }
];

const browser = await chromium.launch({ channel: "chrome", headless: process.argv.includes("--headless") });
try {
  for (const item of windows) {
    const context = await browser.newContext({ viewport: { width: item.width, height: item.height } });
    const page = await context.newPage();
    const loginUrl = new URL(`/login?next=${encodeURIComponent(item.path)}`, baseUrl);
    await page.goto(loginUrl.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.getByRole("button", { name: item.role, exact: true }).click({ timeout: 20_000 });
    await page.waitForURL((url) => url.pathname === item.path, { timeout: 20_000 });
    console.log(`${item.label}: ${new URL(item.path, baseUrl).href}`);
  }
  if (process.argv.includes("--headless")) {
    console.log("Four separate local sessions opened successfully.");
    await browser.close();
  } else {
    console.log("Four separate local sessions are ready. Leave this terminal open; Ctrl+C closes the windows.");
    process.on("SIGINT", () => void browser.close());
    await new Promise((resolve) => browser.once("disconnected", resolve));
  }
} catch (error) {
  await browser.close();
  throw error;
}
