/**
 * OrgReviews.test.tsx
 * Reviews on the public org page (SPEC 3.20, Tier 2): the aggregate, the
 * form offered only to a volunteer with a completed shift here who has not
 * reviewed yet, posting with the public name or anonymously, input checks,
 * plain-text rendering, the coordinator response, and admin removal.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Review } from "@/lib/data/reviews";
import { makeSignup, ts } from "@/test/fixtures";
import { OrgReviews } from "./OrgReviews";

const state = vi.hoisted(() => ({
  user: { uid: "vol-1", isAdmin: false } as { uid: string; isAdmin: boolean } | null,
  reviews: [] as Review[],
  signups: [] as ReturnType<typeof makeSignup>[],
  memberships: [] as Array<{ orgId: string }>
}));
const writes = vi.hoisted(() => ({ createReview: vi.fn(async () => undefined), updateReview: vi.fn(), setReviewResponse: vi.fn(async () => undefined), deleteReview: vi.fn(async () => undefined) }));

vi.mock("@/store/authStore", () => ({ useSessionUser: () => state.user }));
vi.mock("@/hooks/useCuration", () => ({ useOrgReviews: () => ({ data: state.reviews, error: null, isLoading: false }) }));
vi.mock("@/hooks/useInbox", () => ({ useMyPublicUser: () => ({ data: { displayName: "Jordan R." }, error: null, isLoading: false }) }));
vi.mock("@/hooks/useVolunteerData", () => ({ useMySignups: () => ({ data: state.signups, error: null, isLoading: false }) }));
vi.mock("@/hooks/useMemberships", () => ({ useMyMemberships: () => ({ data: state.memberships }) }));
vi.mock("@/lib/data/reviews", () => writes);

const review = (id: string, extra: Partial<Review> = {}): Review => ({
  id,
  orgId: "org-1",
  uid: "someone",
  displayName: "Sam L.",
  rating: 4,
  tags: ["welcoming"],
  text: "<b>Great</b> morning",
  response: null,
  createdAt: ts(Date.UTC(2026, 9, 1, 15)),
  updatedAt: ts(Date.UTC(2026, 9, 1, 15)),
  ...extra
});

const renderReviews = () =>
  render(
    <MemoryRouter>
      <OrgReviews orgId="org-1" orgName="Common Table Pantry" timeZone="America/Chicago" />
    </MemoryRouter>
  );

beforeEach(() => {
  state.user = { uid: "vol-1", isAdmin: false };
  state.reviews = [];
  state.signups = [];
  state.memberships = [];
  Object.values(writes).forEach((mock) => mock.mockClear());
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("OrgReviews", () => {
  it("shows the aggregate and renders review text as plain text", () => {
    state.reviews = [review("r1"), review("r2", { rating: 5, tags: [] })];
    renderReviews();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("4.5 out of 5 from 2 reviews")).toBeInTheDocument();
    expect(screen.getAllByText("<b>Great</b> morning")).toHaveLength(2);
    expect(document.querySelector("article b")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Review your shift" })).not.toBeInTheDocument();
  });

  it("asks visitors to sign in and offers no form", () => {
    state.user = null;
    renderReviews();
    expect(screen.getByText("No reviews yet. Volunteers who finish a shift here can leave one.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });

  it("offers the form only after a completed shift here, then posts with the public name", async () => {
    state.signups = [makeSignup({ id: "shift-1_vol-1", orgId: "org-1", status: "completed" }), makeSignup({ id: "other", orgId: "org-2", status: "completed" })];
    renderReviews();
    const form = screen.getByRole("heading", { name: "Review your shift" }).parentElement as HTMLElement;
    fireEvent.click(within(form).getByRole("button", { name: "Post review" }));
    expect(await within(form).findByText("Choose a rating from 1 to 5 stars.")).toBeInTheDocument();
    expect(writes.createReview).not.toHaveBeenCalled();

    fireEvent.click(within(form).getByLabelText("4 stars"));
    fireEvent.click(within(form).getByLabelText("Welcoming"));
    fireEvent.change(within(form).getByLabelText("Your experience (optional)"), { target: { value: "Friendly team." } });
    fireEvent.click(within(form).getByRole("button", { name: "Post review" }));
    await waitFor(() =>
      expect(writes.createReview).toHaveBeenCalledWith({ signupId: "shift-1_vol-1", orgId: "org-1", uid: "vol-1", displayName: "Jordan R.", fields: { rating: 4, tags: ["welcoming"], text: "Friendly team." } })
    );
    expect(await screen.findByText("Thanks! Your review is posted.")).toBeInTheDocument();
  });

  it("can post anonymously, and hides the form once the volunteer has reviewed", async () => {
    state.signups = [makeSignup({ id: "shift-1_vol-1", orgId: "org-1", status: "completed" })];
    const { unmount } = renderReviews();
    fireEvent.click(screen.getByLabelText("5 stars"));
    fireEvent.click(screen.getByLabelText(/Post as "A volunteer"/));
    fireEvent.click(screen.getByRole("button", { name: "Post review" }));
    await waitFor(() => expect(writes.createReview).toHaveBeenCalledWith(expect.objectContaining({ displayName: "A volunteer" })));
    unmount();

    state.reviews = [review("shift-1_vol-1", { uid: "vol-1", displayName: "A volunteer" })];
    renderReviews();
    expect(screen.queryByRole("heading", { name: "Review your shift" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit my review" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete my review" }));
    await waitFor(() => expect(writes.deleteReview).toHaveBeenCalledWith("shift-1_vol-1"));
  });

  it("does not offer a review for no-shows", () => {
    state.signups = [makeSignup({ id: "s1", orgId: "org-1", status: "no-show" })];
    renderReviews();
    expect(screen.queryByRole("heading", { name: "Review your shift" })).not.toBeInTheDocument();
  });

  it("lets the org's coordinators respond, and shows the response", async () => {
    state.memberships = [{ orgId: "org-1" }];
    state.reviews = [review("r1")];
    const { unmount } = renderReviews();
    fireEvent.click(screen.getByRole("button", { name: "Respond to Sam L." }));
    fireEvent.change(screen.getByLabelText("Response from your organization"), { target: { value: "Thanks for coming!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save response" }));
    await waitFor(() => expect(writes.setReviewResponse).toHaveBeenCalledWith("r1", "vol-1", "Thanks for coming!"));
    unmount();

    state.reviews = [review("r1", { response: { text: "Thanks for coming!", by: "coord", at: ts(0) } })];
    renderReviews();
    expect(screen.getByText("Response from Common Table Pantry")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove review by Sam L." })).not.toBeInTheDocument();
  });

  it("lets admins remove a review", async () => {
    state.user = { uid: "admin-1", isAdmin: true };
    state.reviews = [review("r1")];
    renderReviews();
    fireEvent.click(screen.getByRole("button", { name: "Remove review by Sam L." }));
    await waitFor(() => expect(writes.deleteReview).toHaveBeenCalledWith("r1"));
  });
});
