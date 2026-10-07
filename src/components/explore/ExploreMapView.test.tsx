/**
 * ExploreMapView.test.tsx
 * The List / Map switch (pressed state, keyboard-operable buttons) and the
 * map view's accessible companion list. The Mapbox canvas itself (OrgMap)
 * needs WebGL, so it is replaced with a stub here; its data rules are in
 * src/lib/explore/mapPoints.test.ts.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ExploreMapView, ExploreViewToggle } from "./ExploreMapView";

vi.mock("./OrgMap", () => ({
  default: ({ points }: { points: readonly unknown[] }) => <div data-testid="org-map">{points.length} markers</div>
}));

const POINTS = [
  { orgId: "alamo", name: "Alamo Pantry", lat: 29.4, lng: -98.5, shiftCount: 2 },
  { orgId: "river", name: "River Cleanup", lat: 29.5, lng: -98.4, shiftCount: 1 }
];

describe("ExploreViewToggle", () => {
  it("marks the current view as pressed and reports changes", () => {
    const onChange = vi.fn();
    render(<ExploreViewToggle view="list" onChange={onChange} />);
    const group = screen.getByRole("group", { name: "Show shifts as" });
    expect(within(group).getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    const map = within(group).getByRole("button", { name: "Map" });
    expect(map).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(map);
    expect(onChange).toHaveBeenCalledWith("map");
  });
});

describe("ExploreMapView", () => {
  it("shows the map with a list of the same organizations as links", async () => {
    render(
      <MemoryRouter>
        <ExploreMapView accessToken="pk.test" points={POINTS} homeArea={{ lat: 29.4, lng: -98.5 }} isLoading={false} />
      </MemoryRouter>
    );
    expect(await screen.findByTestId("org-map")).toHaveTextContent("2 markers");
    expect(screen.getByText(/general area \(about 5 km\)/)).toHaveTextContent("The map starts at your ZIP area.");
    const list = screen.getByRole("list", { name: "Organizations on the map" });
    expect(within(list).getByRole("link", { name: "Alamo Pantry" })).toHaveAttribute("href", "/organizations/alamo");
    expect(within(list).getByText("2 shifts in this list")).toBeInTheDocument();
  });

  it("explains an empty map", async () => {
    render(
      <MemoryRouter>
        <ExploreMapView accessToken="pk.test" points={[]} homeArea={null} isLoading={false} />
      </MemoryRouter>
    );
    expect(await screen.findByText("No organizations with matching shifts have a location yet.")).toBeInTheDocument();
    expect(screen.queryByText(/ZIP area/)).toBeNull();
  });
});
