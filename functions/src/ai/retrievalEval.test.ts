/**
 * retrievalEval.test.ts
 * Eval set for assistant grounding (SPEC 8.4): natural questions a volunteer
 * or coordinator would type, each with the article that must be retrieved.
 * Retrieval is what the AI answer is grounded on and what the fallback
 * shows, so "the right article is in the top 3" is the quality bar for both.
 * Questions are phrased the way people ask, not with article titles.
 *
 * Runs against the real articles in src/content/help. If an article rewrite
 * drops a question out of the top 3, fix the article wording (or the
 * expectation, if the question really belongs to another article).
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHelpCorpus, readHelpArticles } from "./helpCorpus";
import { FALLBACK_ARTICLE_COUNT, retrieveArticles } from "./retrieval";

const corpus = createHelpCorpus(readHelpArticles(join(process.cwd(), "src", "content", "help")));

/** [question, slug that must be in the top 3]. */
const EVAL_SET: ReadonlyArray<readonly [string, string]> = [
  ["How do I sign up for a volunteer shift?", "find-and-sign-up"],
  ["The shift is full, can I still get a spot?", "waitlist-and-promotion"],
  ["When does check-in open before my shift?", "kiosk-check-in"],
  ["The kiosk code keeps saying it expired", "troubleshooting-check-in"],
  ["How are my volunteer hours rounded when I check out?", "check-out-and-hours"],
  ["How do I get a letter proving my hours for school?", "verified-letters"],
  ["How can a teacher check that my hours letter is real?", "verify-a-letter"],
  ["I volunteered somewhere that doesn't use the app, how do I add those hours?", "manual-hours"],
  ["I was marked as a no-show but I was there", "attendance-disputes"],
  ["How do I put my shift in Google Calendar?", "calendar-export"],
  ["Will I get an email or text when I'm promoted off the waitlist?", "alerts-are-in-app"],
  ["Can I make the text bigger?", "accessibility-settings"],
  ["I'm 15, what are the rules for minors?", "privacy-and-minors"],
  ["How do I register my nonprofit organization?", "org-registration"],
  ["How do I add another coordinator to my organization?", "coordinator-invites"],
  ["Where do I approve hours that need review?", "coordinator-needs-attention"],
  ["How do I start the check-in tablet for my shift?", "coordinator-start-kiosk"],
  ["What does my reliability score mean?", "track-record"],
  // Tier 1 lane A and B features
  ["Where do I change my ZIP code or my interests?", "edit-profile"],
  ["Where can I see every upcoming shift one nonprofit has?", "organization-page"],
  ["If the coordinator adds more seats, do people on the waitlist get in?", "waitlist-and-promotion"],
  ["Can I type the shift in plain English and have the form filled in?", "coordinator-create-shifts"],
  ["Where are the shifts I bookmarked for later?", "saved-items"]
];

describe("assistant retrieval eval (SPEC 8.4 grounding)", () => {
  it.each(EVAL_SET)("%j retrieves %s in the top 3", (question, slug) => {
    const top = retrieveArticles(corpus, question, FALLBACK_ARTICLE_COUNT).map((article) => article.slug);
    expect(top).toContain(slug);
  });

  it("scores at least 15 questions and every expected slug is a real article", () => {
    expect(EVAL_SET.length).toBeGreaterThanOrEqual(15);
    expect(EVAL_SET.filter(([, slug]) => corpus.getArticle(slug) === undefined)).toEqual([]);
  });

  it("retrieves nothing for a question with no help words", () => {
    expect(retrieveArticles(corpus, "zzzz qqqq")).toEqual([]);
  });
});
