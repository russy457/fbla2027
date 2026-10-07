import { describe, it, expect } from "vitest";
import { SearchEngine } from "./searchEngine";
import type { SearchableRecord } from "./types";

const RECORDS: SearchableRecord[] = [
  {
    id: "taco-town",
    fields: {
      name: "Taco Town",
      category: "Restaurant",
      subcategory: "Mexican",
      city: "Austin",
      description: "the best tacos in town"
    },
    location: { lat: 30.2672, lng: -97.7431 }
  },
  {
    id: "tea-house",
    fields: {
      name: "Tea House",
      category: "Cafe",
      subcategory: "Tea",
      city: "Austin",
      description: "green tea and coffee"
    },
    location: { lat: 30.27, lng: -97.74 }
  },
  {
    id: "burger-barn",
    fields: {
      name: "Burger Barn",
      category: "Restaurant",
      subcategory: "American",
      city: "Dallas",
      description: "juicy burgers and fries"
    },
    location: { lat: 32.7767, lng: -96.797 }
  },
  {
    id: "coffee-co",
    fields: {
      name: "Coffee Co",
      category: "Cafe",
      subcategory: "Coffee",
      city: "Austin",
      description: "artisan roasts"
    },
    location: { lat: 30.25, lng: -97.75 }
  }
];

const WEIGHTS = { name: 3, category: 2, subcategory: 1.5, city: 1, description: 1 };
const engine = (): SearchEngine => SearchEngine.build(RECORDS, { fieldWeights: WEIGHTS });

describe("SearchEngine.search", () => {
  it("finds the exact match and nothing irrelevant", () => {
    const results = engine().search("taco");
    expect(results.map((r) => r.id)).toEqual(["taco-town"]);
  });

  it("treats a plural query the same as the singular (shared tokenizer)", () => {
    expect(engine().search("tacos").map((r) => r.id)).toEqual(["taco-town"]);
  });

  it("tolerates a one-character typo via fuzzy matching", () => {
    const fuzzy = engine().search("tako"); // typo for "taco"
    expect(fuzzy.map((r) => r.id)).toContain("taco-town");
  });

  it("returns nothing for the same typo when fuzzy is disabled", () => {
    expect(engine().search("tako", { fuzzy: false })).toEqual([]);
  });

  it("ranks a name hit above a description hit (field weighting)", () => {
    const results = engine().search("coffee");
    const ids = results.map((r) => r.id);
    expect(ids).toContain("coffee-co"); // name match
    expect(ids).toContain("tea-house"); // description match
    expect(ids.indexOf("coffee-co")).toBeLessThan(ids.indexOf("tea-house"));
  });

  it("filters by radius when searching near a point", () => {
    const near = { lat: 30.2672, lng: -97.7431 }; // Austin
    const results = engine().search("restaurant", { near, radiusMiles: 50 });
    expect(results.map((r) => r.id)).toEqual(["taco-town"]); // Dallas excluded
    expect(results[0]?.distanceMiles).toBeLessThan(1);
  });

  it("attaches distance and orders nearer first on score ties", () => {
    const near = { lat: 30.2672, lng: -97.7431 };
    const results = engine().search("restaurant", { near });
    expect(results.map((r) => r.id)).toEqual(["taco-town", "burger-barn"]);
    expect(results[1]?.distanceMiles).toBeGreaterThan(results[0]!.distanceMiles!);
  });

  it("respects the limit option", () => {
    const results = engine().search("austin cafe restaurant", { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns an empty array for empty or all-stopword queries", () => {
    expect(engine().search("")).toEqual([]);
    expect(engine().search("the and of")).toEqual([]);
  });

  it("returns an empty array when nothing is even close", () => {
    expect(engine().search("zzzzzz")).toEqual([]);
  });
});

describe("SearchEngine.suggest", () => {
  it("autocompletes from a prefix", () => {
    expect(engine().suggest("ta").map((s) => s.id)).toContain("taco-town");
    expect(engine().suggest("te").map((s) => s.id)).toContain("tea-house");
  });

  it("surfaces the strongest match first", () => {
    const suggestions = engine().suggest("co");
    expect(suggestions[0]?.id).toBe("coffee-co");
  });

  it("returns nothing for an empty prefix", () => {
    expect(engine().suggest("")).toEqual([]);
  });

  it("honors the limit", () => {
    expect(engine().suggest("a", 1).length).toBeLessThanOrEqual(1);
  });
});

describe("SearchEngine serialize/deserialize", () => {
  it("round-trips to an identical engine (same search + suggest output)", () => {
    const original = engine();
    const restored = SearchEngine.deserialize(JSON.parse(JSON.stringify(original.serialize())));

    for (const q of ["coffee", "taco", "restaurant", "austin"]) {
      expect(restored.search(q)).toEqual(original.search(q));
    }
    expect(restored.suggest("co")).toEqual(original.suggest("co"));
  });

  it("produces a compact artifact carrying postings, lengths, and coordinates", () => {
    const data = engine().serialize();
    expect(data.version).toBe(1);
    expect(data.totalDocs).toBe(4);
    expect(Object.keys(data.postings)).toContain("coffee");
    expect(data.coordinates["taco-town"]).toEqual([30.2672, -97.7431]);
  });
});
