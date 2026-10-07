/**
 * AttendanceEditor.test.tsx
 * setAttendance form (SPEC 5.7): the options offered per status, minutes
 * required (and limited to the scheduled length) for Completed, a note is
 * required, and the op receives exactly what was chosen.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceEditor, attendanceTargetsFor, type AttendanceEditorProps } from "./AttendanceEditor";

const setAttendance = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { coordinator: { setAttendance: (input: unknown) => setAttendance(input) } } };
});

const renderEditor = (props: Partial<AttendanceEditorProps> = {}) => {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <AttendanceEditor signupId="s1_u1" name="Jordan R." status="no-show" disputeOpen={false} scheduledMinutes={60} onClose={onClose} {...props} />
    </MemoryRouter>
  );
  return onClose;
};

describe("attendanceTargetsFor", () => {
  it("follows the SPEC 5.7 table", () => {
    expect(attendanceTargetsFor("no-show", false)).toEqual(["excused", "completed"]);
    expect(attendanceTargetsFor("no-show", true)).toEqual(["excused", "completed", "keep"]);
    expect(attendanceTargetsFor("completed", false)).toEqual(["no-show"]);
    expect(attendanceTargetsFor("confirmed", false)).toEqual([]);
  });
});

describe("AttendanceEditor", () => {
  beforeEach(() => setAttendance.mockReset());

  it("offers Keep only with an open review request", () => {
    renderEditor({ disputeOpen: true });
    expect(screen.getByRole("radio", { name: /Keep as no-show/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Excused" })).toHaveFocus();
  });

  it("requires minutes for completed, capped at the scheduled length", async () => {
    setAttendance.mockResolvedValue({ status: "completed", logId: "s1_u1", changed: true });
    const onClose = renderEditor();
    fireEvent.click(screen.getByRole("radio", { name: "Completed (credit hours)" }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Was there, signed paper sheet" } });
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(screen.getByText("Enter the minutes served.")).toBeInTheDocument();
    const minutes = screen.getByLabelText("Minutes served");
    expect(minutes.querySelectorAll("option")).toHaveLength(6); // choose + 0..60 in 15s
    fireEvent.change(minutes, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(setAttendance).toHaveBeenCalledWith({ signupId: "s1_u1", to: "completed", minutes: 45, note: "Was there, signed paper sheet" });
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("Attendance for Jordan R. saved."));
  });

  it("requires a note, then sends no-show for a completed signup", () => {
    setAttendance.mockResolvedValue({ status: "no-show", logId: "s1_u1", changed: true });
    renderEditor({ status: "completed" });
    fireEvent.click(screen.getByRole("radio", { name: "No-show" }));
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(screen.getByText("Write a short note (at least 3 characters).")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Left before start" } });
    fireEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(setAttendance).toHaveBeenCalledWith({ signupId: "s1_u1", to: "no-show", note: "Left before start" });
  });
});
