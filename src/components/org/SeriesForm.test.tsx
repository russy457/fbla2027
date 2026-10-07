/**
 * SeriesForm.test.tsx
 * The repeat-rule form: native checkbox and radio semantics, the live
 * plain-English summary, monthly week picker, inline errors next to the
 * field, and the submitted upsertSeries input.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialSeriesValues } from "./NewSeriesSection";
import { SeriesForm } from "./SeriesForm";

const NOW = Date.UTC(2026, 9, 17, 13, 0, 0);
const START = { date: "2026-10-17", startTime: "09:00", endTime: "13:00", capacity: 12 };

const renderForm = (onSubmit = vi.fn()) => {
  render(<SeriesForm timeZone="America/Chicago" nowMs={NOW} initial={initialSeriesValues(START)} submitLabel="Create series" isPending={false} onSubmit={onSubmit} />);
  return onSubmit;
};

describe("SeriesForm", () => {
  it("starts weekly on the planner date's weekday and reads the rule back in words", () => {
    renderForm();
    expect(screen.getByRole("radio", { name: "Every week" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Saturday" })).toBeChecked();
    expect(screen.getByText("Every Saturday, 9:00 AM to 1:00 PM")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time (CDT)")).toHaveValue("09:00");
  });

  it("updates the summary as days and frequency change", () => {
    renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: "Wednesday" }));
    fireEvent.click(screen.getByRole("radio", { name: "Every other week" }));
    expect(screen.getByText("Every other Wednesday and Saturday, 9:00 AM to 1:00 PM")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Once a month" }));
    fireEvent.change(screen.getByLabelText("Week of the month"), { target: { value: "-1" } });
    expect(screen.getByText("The last Wednesday and Saturday of each month, 9:00 AM to 1:00 PM")).toBeInTheDocument();
  });

  it("shows the error next to the field and does not submit", () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: "Saturday" }));
    expect(screen.getByText("Pick days and times to see the schedule.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create series" }));
    expect(screen.getByText("Pick at least one day.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Saturday" }));
    fireEvent.change(screen.getByLabelText("End time (CDT)"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create series" }));
    expect(screen.getByText("The end time must be after the start time on the same day.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the rule, seats, and dates", () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText("Last date (optional)"), { target: { value: "2026-12-19" } });
    fireEvent.click(screen.getByRole("button", { name: "Create series" }));
    expect(onSubmit).toHaveBeenCalledWith({
      rule: { frequency: "weekly", weekdays: [6], startTime: "09:00", endTime: "13:00" },
      capacity: 12,
      startsOn: "2026-10-17",
      endsOn: "2026-12-19"
    });
  });
});
