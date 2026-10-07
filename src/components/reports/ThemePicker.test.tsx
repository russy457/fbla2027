/**
 * ThemePicker.test.tsx
 * D16 / SPEC 12.1 "report theme contrast (4.5:1)": six preset themes, each
 * named in text, each readable for white text on its accent and for the
 * accent as text on white; choosing one reports its id.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MIN_TEXT_CONTRAST, REPORT_THEMES, REPORT_THEME_IDS, contrastRatio } from "@fbla/shared";
import { ThemePicker } from "./ThemePicker";

describe("ThemePicker", () => {
  it("offers the six presets as a labeled radio group", () => {
    render(<ThemePicker value="neutral" onChange={() => undefined} />);
    expect(screen.getByRole("group", { name: "PDF theme" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: "Neutral" })).toBeChecked();
  });

  it.each(REPORT_THEME_IDS)("%s passes 4.5:1 both ways", (id) => {
    const theme = REPORT_THEMES[id];
    expect(contrastRatio(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    // Every preset's onAccent is white, the PDF page color, so this is also "accent text on the page".
    expect(contrastRatio(theme.accent, REPORT_THEMES.neutral.onAccent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("reports the chosen theme", () => {
    const onChange = vi.fn();
    render(<ThemePicker value="neutral" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "High contrast" }));
    expect(onChange).toHaveBeenCalledWith("high-contrast");
  });
});
