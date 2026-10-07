/**
 * answerQuestion.test.ts
 * The Tier 0 Ask box answers from help articles only. These tests cover the
 * labeled answer, the no-match state, and the 2,000-character limit.
 */
import { describe, expect, it } from "vitest";
import { answerFromHelpCenter, HELP_ANSWER_LABEL, MAX_QUESTION_CHARS } from "./answerQuestion";
import { createFixtureLibrary } from "./testFixtures";

const library = createFixtureLibrary();

describe("answerFromHelpCenter", () => {
  it("answers with at most three articles labeled From Help Center", () => {
    const answer = answerFromHelpCenter("how do I check in with the kiosk code?", library);
    expect(answer.kind).toBe("articles");
    if (answer.kind !== "articles") return;
    expect(answer.label).toBe(HELP_ANSWER_LABEL);
    expect(answer.hits.length).toBeLessThanOrEqual(3);
    expect(answer.hits[0]?.article.slug).toBe("kiosk-check-in");
  });

  it("reports an empty question", () => {
    expect(answerFromHelpCenter("   ", library)).toEqual({ kind: "empty-question" });
  });

  it("reports when nothing matches", () => {
    expect(answerFromHelpCenter("zzzz qqqq", library)).toEqual({ kind: "no-match" });
  });

  it("refuses questions over the shared character limit", () => {
    const answer = answerFromHelpCenter("a".repeat(MAX_QUESTION_CHARS + 1), library);
    expect(answer).toEqual({ kind: "too-long", message: "Keep it under 2,000 characters." });
  });
});
