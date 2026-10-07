/**
 * collections.test.tsx
 * Curated collections UI (SPEC 3.19, Tier 2): the Explore section lists
 * published collections with counts and the curator (and hides when there
 * are none); the manager creates a collection with one requestNonce (via the
 * callable-backed data layer), validates the title, keeps picks in order,
 * publishes or unpublishes from the list, and deletes after confirming.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CuratedCollection } from "@/lib/data/curatedCollections";
import { ts } from "@/test/fixtures";
import { CollectionManager } from "./CollectionManager";
import { FeaturedCollections } from "./FeaturedCollections";

const state = vi.hoisted(() => ({ published: [] as CuratedCollection[], owned: [] as CuratedCollection[] }));
const data = vi.hoisted(() => ({
  saveCollection: vi.fn(async () => "new-id"),
  deleteCollection: vi.fn(async () => undefined),
  setCollectionPublished: vi.fn(async () => undefined)
}));

vi.mock("@/hooks/useCuration", () => ({
  usePublishedCollections: () => ({ data: state.published, error: null, isLoading: false }),
  useOwnedCollections: () => ({ data: state.owned, error: null, isLoading: false })
}));
vi.mock("@/hooks/useInbox", () => ({
  useActiveOpportunities: () => ({ data: [{ id: "opp-1", orgId: "org-1", orgName: "Alamo Pantry", title: "Sort food" }, { id: "opp-2", orgId: "org-2", orgName: "Book Bank", title: "Shelve books" }] })
}));
vi.mock("@/lib/data/orgs", () => ({ getOrganizations: async () => [{ id: "org-1", name: "Alamo Pantry", verified: true, archived: false }] }));
vi.mock("@/lib/data/curatedCollections", () => data);
vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), newRequestNonce: () => "nonce-1" }));
vi.mock("@/store/authStore", () => ({ useSessionUser: () => ({ uid: "coord-1", isAdmin: false }) }));

const collection = (id: string, extra: Partial<CuratedCollection> = {}): CuratedCollection => ({
  id,
  title: "Good first shifts",
  description: "Easy ways to start.",
  items: [{ kind: "opportunity", refId: "opp-1" }, { kind: "org", refId: "org-1" }],
  orgId: "org-1",
  authorUid: "coord-1",
  published: true,
  updatedAt: ts(0),
  ...extra
});

const wrap = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  state.published = [];
  state.owned = [];
  Object.values(data).forEach((mock) => mock.mockClear());
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("FeaturedCollections", () => {
  it("renders nothing without published collections", () => {
    const { container } = wrap(<FeaturedCollections />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each published collection with its contents and curator", async () => {
    state.published = [collection("c1"), collection("c2", { title: "Team picks", orgId: null, items: [] })];
    wrap(<FeaturedCollections />);
    expect(screen.getByRole("heading", { name: "Collections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Good first shifts" })).toHaveAttribute("href", "/collections/c1");
    expect(await screen.findByText(/1 shift and 1 organization · by Alamo Pantry/)).toBeInTheDocument();
    expect(screen.getByText(/Empty · by the Pitch In team/)).toBeInTheDocument();
  });
});

describe("CollectionManager", () => {
  it("creates a collection with picks in order under one request nonce", async () => {
    wrap(<CollectionManager orgId="org-1" headingId="h" />);
    expect(screen.getByText(/No collections yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New collection" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fun" } });
    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    expect(await screen.findByText(/at least 4|Too small|>=4/i)).toBeInTheDocument();
    expect(data.saveCollection).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Weekend food drives" } });
    fireEvent.click(screen.getByLabelText(/Shelve books/));
    fireEvent.click(screen.getByLabelText(/Sort food/));
    expect(screen.getByText("2 of 30 picked.")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Published/));
    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    await waitFor(() =>
      expect(data.saveCollection).toHaveBeenCalledWith({
        collectionId: null,
        requestNonce: "nonce-1",
        orgId: "org-1",
        fields: {
          title: "Weekend food drives",
          description: "",
          items: [{ kind: "opportunity", refId: "opp-2" }, { kind: "opportunity", refId: "opp-1" }],
          published: true
        }
      })
    );
    expect(await screen.findByText('Saved and published "Weekend food drives".')).toBeInTheDocument();
  });

  it("edits update the existing collection, publish toggles, and delete asks first", async () => {
    const item = collection("c1", { authorUid: "someone-else", published: false });
    state.owned = [item];
    wrap(<CollectionManager orgId="org-1" headingId="h" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish Good first shifts" }));
    await waitFor(() => expect(data.setCollectionPublished).toHaveBeenCalledWith(item, true));
    expect(await screen.findByText('Published "Good first shifts" to Explore.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete Good first shifts" }));
    await waitFor(() => expect(data.deleteCollection).toHaveBeenCalledWith(item));

    fireEvent.click(screen.getByRole("button", { name: "Edit Good first shifts" }));
    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    await waitFor(() => expect(data.saveCollection).toHaveBeenCalledWith(expect.objectContaining({ collectionId: "c1", orgId: "org-1" })));
  });

  it("shows the catalog error when a write is refused", async () => {
    const { ApiError } = await import("@/lib/api");
    data.deleteCollection.mockRejectedValueOnce(
      new ApiError({ code: "PERMISSION_DENIED", title: "Not allowed", message: "You can't do that here.", fix: "Ask an owner.", helpSlug: null, requestId: "req-1", params: {} })
    );
    state.owned = [collection("c1")];
    wrap(<CollectionManager orgId="org-1" headingId="h" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Good first shifts" }));
    expect(await screen.findByText("You can't do that here.")).toBeInTheDocument();
  });
});
