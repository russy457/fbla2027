/**
 * SectionSelector.test.tsx
 * Section toggles (SPEC 8.6): the kind's sections in canonical order,
 * toggling keeps canonical order, and the last section on cannot be turned off.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionSelector } from "./SectionSelector";

describe("SectionSelector", () => {
  it("lists the org report sections and toggles them in canonical order", () => {
    const onChange = vi.fn();
    render(<SectionSelector kind="org-participation" selected={["topVolunteers"]} onChange={onChange} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    fireEvent.click(screen.getByRole("checkbox", { name: "Summary" }));
    expect(onChange).toHaveBeenCalledWith(["summary", "topVolunteers"]);
  });

  it("keeps the last selected section on", () => {
    render(<SectionSelector kind="volunteer-hours" selected={["milestones"]} onChange={() => undefined} />);
    expect(screen.getByRole("checkbox", { name: "Milestones" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Shift list" })).toBeEnabled();
  });

  it("turns a section off", () => {
    const onChange = vi.fn();
    render(<SectionSelector kind="volunteer-hours" selected={["summary", "milestones"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Summary" }));
    expect(onChange).toHaveBeenCalledWith(["milestones"]);
  });
});
