/**
 * markNotificationsRead.ts
 * volunteer.markNotificationsRead (SPEC 5.2, Appendix B item 15): the only
 * way a notification's `read` flag changes, since clients cannot write
 * notifications. Set semantics: already-read and missing items are skipped,
 * so a retry is harmless. Only the caller's own items are touched, because
 * the path is built from the caller's uid, never from input.
 *
 *   { itemIds: [...] }  marks those items (at most 100)
 *   { all: true }       marks every unread item (Q23: read == false), in pages
 */
import { PATHS, type NotificationDoc } from "@fbla/shared";
import { profileComplete } from "../lib/auth";
import { defineCallable } from "../lib/defineCallable";
import { ts } from "../lib/firestore";

/** Unread items marked per batch when `all` is set; a batch holds at most 500 writes. */
const PAGE_SIZE = 400;
/** Upper bound on pages for one call, so a huge backlog cannot keep the function running. */
const MAX_PAGES = 10;

export const markNotificationsRead = defineCallable({
  endpoint: "volunteer",
  op: "markNotificationsRead",
  auth: profileComplete(),
  handler: async ({ input, caller, clock, deps }) => {
    const { db } = deps;
    const items = db.collection(PATHS.notificationItems(caller.uid));
    const nowMs = clock.nowMs();

    if (input.itemIds !== undefined) {
      const ids = [...new Set(input.itemIds)];
      const snapshots = await db.getAll(...ids.map((id) => items.doc(id)));
      const unread = snapshots.filter((snapshot) => snapshot.exists && (snapshot.data() as NotificationDoc).read === false);
      if (unread.length === 0) return { updated: 0 };
      const batch = db.batch();
      unread.forEach((snapshot) => batch.update(snapshot.ref, { read: true, updatedAt: ts(nowMs) }));
      await batch.commit();
      return { updated: unread.length };
    }

    let updated = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const unread = await items.where("read", "==", false).limit(PAGE_SIZE).get();
      if (unread.empty) break;
      const batch = db.batch();
      unread.docs.forEach((doc) => batch.update(doc.ref, { read: true, updatedAt: ts(nowMs) }));
      await batch.commit();
      updated += unread.size;
      if (unread.size < PAGE_SIZE) break;
    }
    return { updated };
  }
});
