import { describe, expect, it } from "vitest";
import { parseCssDurationSeconds, readDurationSeconds } from "./motionTokens";

describe("parseCssDurationSeconds", () => {
  it("converts milliseconds and seconds", () => {
    expect(parseCssDurationSeconds("240ms")).toBe(0.24);
    expect(parseCssDurationSeconds(" 0.4s ")).toBe(0.4);
    expect(parseCssDurationSeconds("0ms")).toBe(0);
  });

  it("returns null for values that are not durations", () => {
    expect(parseCssDurationSeconds("")).toBeNull();
    expect(parseCssDurationSeconds("fast")).toBeNull();
  });
});

describe("readDurationSeconds", () => {
  it("reads a token set on the root element", () => {
    document.documentElement.style.setProperty("--duration-slow", "400ms");
    expect(readDurationSeconds("--duration-slow", 1)).toBe(0.4);
    document.documentElement.style.removeProperty("--duration-slow");
  });

  it("falls back when the token is missing", () => {
    expect(readDurationSeconds("--duration-fast", 0.15)).toBe(0.15);
  });
});
