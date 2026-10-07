/**
 * ProfilePage.test.tsx
 * /me/profile (SPEC#screen-inventory "Profile"): shows the stored values,
 * saves only what changed through volunteer.updateProfile (pending until it
 * returns, then a status line), explains a ZIP outside the bundled area,
 * validates the phone before calling, flips the Discoverable toggle as an
 * allowlisted client write, and links to the display settings. Explore's
 * "Add interests" and distance hints link to this page's groups.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateProfileDoc } from "@fbla/shared";
import { ExploreFilters } from "@/components/explore/ExploreFilters";
import { RecommendedShifts } from "@/components/explore/RecommendedShifts";
import { EMPTY_FILTERS } from "@/lib/explore/filters";
import { emptyAvailability } from "@/lib/onboardingDraft";
import { ts } from "@/test/fixtures";
import ProfilePage from "./ProfilePage";

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn(), saveDiscoverable: vi.fn() }));
const state = vi.hoisted(() => ({ profile: null as (PrivateProfileDoc & { id: string }) | null }));

vi.mock("@/store/authStore", () => ({ useSessionUser: () => ({ uid: "uid-1", email: "jordan@example.test", isAdmin: false }) }));
vi.mock("@/hooks/useVolunteerData", () => ({ usePrivateProfile: () => ({ data: state.profile, error: null, isLoading: false }) }));
vi.mock("@/lib/preferenceSync", () => ({ saveDiscoverable: (uid: string, value: boolean) => mocks.saveDiscoverable(uid, value) }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { volunteer: { updateProfile: (input: unknown) => mocks.updateProfile(input) } } };
});

const storedProfile = (): PrivateProfileDoc & { id: string } => ({
  id: "profile",
  firstName: "Jordan",
  lastName: "Rivera",
  fullName: "Jordan Rivera",
  email: "jordan@example.test",
  phone: "+12105550100",
  birthDate: "2007-03-02",
  isMinor: false,
  interests: ["hunger-food-security"],
  skills: ["Spanish"],
  availability: null,
  zip: "78204",
  homeGeohash: "9v1zq",
  profileComplete: true,
  profileCompletedAt: ts(0),
  turnstileVerifiedAt: null,
  reliability: { attended: 0, noShows: 0, lateCancels: 0, total: 0, score: null, isNew: true, windowFrom: null },
  createdAt: ts(0),
  updatedAt: ts(0)
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/me/profile"]}>
      <ProfilePage />
    </MemoryRouter>
  );

describe("ProfilePage", () => {
  // Block bodies: a function returned from beforeEach would run as a teardown hook.
  beforeEach(() => {
    state.profile = storedProfile();
    mocks.updateProfile.mockReset();
    mocks.saveDiscoverable.mockReset();
  });

  it("shows the stored profile, with birth date read-only", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Jordan");
    expect(screen.getByLabelText("Phone (optional)")).toHaveValue("(210) 555-0100");
    expect(screen.getByLabelText("ZIP code (optional)")).toHaveValue("78204");
    expect(screen.getByRole("checkbox", { name: "Hunger and food" })).toBeChecked();
    expect(screen.getByText("2007-03-02")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Display settings" })).toHaveAttribute("href", "#display-preferences");
  });

  it("sends only the changed fields, pending until the op returns", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.updateProfile.mockReturnValue(new Promise((done) => (resolve = done)));
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Environment" }));
    fireEvent.change(screen.getByLabelText("ZIP code (optional)"), { target: { value: "78212" } });
    fireEvent.click(within(screen.getByRole("group", { name: "Saturday" })).getByRole("checkbox", { name: "morning" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(mocks.updateProfile).toHaveBeenCalledWith({
      interests: ["hunger-food-security", "environment"],
      availability: { ...emptyAvailability(), sat: { morning: true, afternoon: false, evening: false } },
      zip: "78212"
    });
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    resolve({ displayName: "Jordan R.", homeGeohash: "9v1zw" });
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });

  it("explains a ZIP outside the bundled area and says when nothing changed", async () => {
    mocks.updateProfile.mockResolvedValue({ displayName: "Jordan R.", homeGeohash: null });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText("Nothing changed.")).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("ZIP code (optional)"), { target: { value: "10001" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText(/cannot locate that ZIP yet/)).toBeInTheDocument();
  });

  it("checks the phone and ZIP before calling the server", () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Phone (optional)"), { target: { value: "555-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText("Enter a 10-digit phone number, or leave it blank.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Phone (optional)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("ZIP code (optional)"), { target: { value: "782" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByText("Enter a 5-digit ZIP code, or leave it blank.")).toBeInTheDocument();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("the Discoverable toggle writes notificationPrefs for this user", () => {
    mocks.saveDiscoverable.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(screen.getByRole("checkbox", { name: "Let new organizations invite me" }));
    expect(mocks.saveDiscoverable).toHaveBeenCalledWith("uid-1", true);
  });
});

describe("links into the profile", () => {
  it("Explore's Add interests and Add your ZIP code open the matching group", () => {
    render(
      <MemoryRouter>
        <RecommendedShifts picks={[]} hasInterests={false} />
        <ExploreFilters filters={{ ...EMPTY_FILTERS, cause: "environment" }} onChange={vi.fn()} resultCount={0} signedIn canUseDistance={false} orgName={null} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Add interests" })).toHaveAttribute("href", "/me/profile#interests");
    expect(screen.getByRole("link", { name: "Add your ZIP code" })).toHaveAttribute("href", "/me/profile#zip");
  });
});
