/**
 * OrgProfileForm.test.tsx
 * The org registration/settings form (SPEC 5.8): EIN hint and format error,
 * cause areas capped at 3, blank optional fields sent as null, and the
 * read-only view for coordinators.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrgProfileForm } from "./OrgProfileForm";

const fill = (label: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const fillValid = (): void => {
  fill("Organization name", "Eastside Tool Library");
  fill("Mission", "Lending tools to neighbors.");
  fireEvent.click(screen.getByRole("checkbox", { name: "Community building" }));
  fill("EIN", "74-1234567");
  fill("Street address", "1 Main St");
  fill("City", "Example City");
  fill("ZIP", "78205");
  fill("Contact email", "hello@tools.example.org");
};

describe("OrgProfileForm", () => {
  it("shows the EIN format hint and refuses a malformed EIN", () => {
    const onSubmit = vi.fn();
    render(<OrgProfileForm submitLabel="Register organization" isPending={false} onSubmit={onSubmit} />);
    expect(screen.getByText("Format NN-NNNNNNN, from your IRS letter.")).toBeInTheDocument();
    fillValid();
    fill("EIN", "741234567");
    fireEvent.click(screen.getByRole("button", { name: "Register organization" }));
    expect(screen.getByText("Enter the EIN as NN-NNNNNNN.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid values with blank optional fields as null", () => {
    const onSubmit = vi.fn();
    render(<OrgProfileForm submitLabel="Register organization" isPending={false} onSubmit={onSubmit} />);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Register organization" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Eastside Tool Library", ein: "74-1234567", causeAreas: ["community-development"], contactPhone: null, website: null, timeZone: "America/Chicago" })
    );
  });

  it("caps cause areas at three and requires one", () => {
    render(<OrgProfileForm submitLabel="Save" isPending={false} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Pick 1 to 3 cause areas.")).toBeInTheDocument();
    ["Seniors", "Animals", "Environment"].forEach((name) => fireEvent.click(screen.getByRole("checkbox", { name })));
    expect(screen.getByRole("checkbox", { name: "Arts and culture" })).toBeDisabled();
  });

  it("is read-only for coordinators", () => {
    render(<OrgProfileForm submitLabel="Save" isPending={false} readOnly onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Organization name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("Only the organization owner can edit these details.")).toBeInTheDocument();
  });
});
