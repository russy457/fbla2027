# Tandem feature specification

**Status:** As built in the repository on 2026-10-28. This is an inventory of implemented behavior, not a list of ideas. [SPEC.md](SPEC.md) holds the detailed data schemas, operation inputs, state transitions, and timing rules. [DESIGN.md](DESIGN.md) holds the visual contract. Feature availability in a deployment depends on its Firebase services, secrets, and environment flags.

## 1. Product and people

Tandem connects a volunteer's whole path: find a shift, reserve a place, show up, record attendance, count approved hours, and share proof. A nonprofit can publish the work, fill its roster, run check-in, review exceptions, and report participation. The public can check whether an issued hours letter is still valid.

| Person | What they can do |
|---|---|
| Visitor | Browse shifts, organizations, collections, help, legal pages, and letter verification. |
| Volunteer | Complete a profile, sign up, check in and out, manage shifts, submit outside hours, review progress, create letters and reports, save items, receive alerts, and review organizations where they served. |
| Organization coordinator | Manage shifts, rosters, attendance, hours, reports, invitations, and collections for organizations they belong to. |
| Organization owner | Do coordinator work and manage organization details, members, invites, and letters that include the organization's hours. |
| Administrator | Verify organizations, inspect background jobs, revoke letters by code, curate app-wide collections, and use guarded demo controls. |
| Kiosk session | Show one shift's rotating code, QR, countdown, and live arrivals. It cannot browse the rest of the app. |

The public landing page at `/` and the scheduling page at `/explore` are separate experiences. Navigation changes by role and contracts to an icon pill on scroll. [Routes](../src/router.tsx) and [navigation](../src/layouts/navItems.ts) define the current surface.

## 2. Public discovery

### Home and Explore

- The home page introduces Tandem with a full-width photograph, cause links, and a direct route into shift discovery. A three-scene scroll story pairs food, outdoor, and youth photos with a moving tandem bike; step buttons also move between scenes. Cause links open a matching Explore filter. Enlarged-text, reduced-motion, and short-viewport layouts show the stories in normal flow. The scenes and image crops are configured in shared media metadata. [Home](../src/pages/LandingPage.tsx), [story content](../src/content/homeJourney.ts), [media](../src/content/pageVisuals.ts)
- Explore opens with a photographic scene, then a live schedule with day choices. Upcoming shifts show date, local time, organization, remaining seats, status, and the action available to that visitor. It has loading, error, no-results, and clear-filter states. [Explore](../src/pages/ExplorePage.tsx), [schedule](../src/components/explore/ScheduleBoard.tsx)
- Search covers shifts and organizations using an inverted index, BM25 ranking, autocomplete, typo tolerance, and location helpers. Filters cover cause, opportunity type, weekday, time of day, date range, distance, available seats, age eligibility, verified organizations, and one organization. The URL stores filter state, so a link can be shared and browser Back restores it. Distance requires a supported ZIP area in the volunteer profile. [Filters](../src/components/explore/ExploreFilters.tsx), [search](../src/lib/search/searchEngine.ts)
- A volunteer can switch to a map when a public Mapbox token is configured. Markers use coarse organization locations; a missing token leaves the list usable. [Map](../src/components/explore/ExploreMapView.tsx), [map points](../src/lib/explore/mapPoints.ts)
- Personalized recommendations use interests, skills, availability, and approximate distance, with a plain-language reason for each suggestion. They exclude shifts the person already joined or cannot currently join, including schedule clashes. The onboarding finish screen also suggests three matching shifts. [Recommendations](../src/lib/explore/recommendations.ts), [matching](../shared/src/match.ts)
- Cause photographs and published curated collections provide other ways into the same live shift data. A collection can mix opportunities and organizations; a draft is visible only to its authorized team. [Collections](../src/pages/CollectionPage.tsx)

### Shift and organization pages

- Each shift page shows local date and time with zone, place or virtual status, available seats, description, organization, signup state, and any recurring-series action. It links back to the organization. A named shift uses a plain opening until the organization supplies a suitable image. [Shift page](../src/pages/OpportunityPage.tsx)
- Public organization pages show mission, cause areas, address, website when safe, verification status, upcoming shifts, and reviews. Visitors can see why an unverified organization has different rules for minors. [Organization page](../src/pages/OrganizationPage.tsx)
- Signed-in volunteers can save opportunities and organizations, view them at `/me/saved`, and remove them. [Saved](../src/pages/SavedPage.tsx)
- A volunteer who completed a shift at an organization can post one review there. Reviews have a 1–5 rating, optional tags and text, and a public-name or anonymous choice. Authors can edit or delete; coordinators can respond; admins can remove a review. An edit cooldown and Firestore rules limit abuse. [Reviews](../src/components/reviews/OrgReviews.tsx), [review rules](../firestore.rules)

## 3. Account, profile, and access

- Email and password sign-in returns the person to a safe same-site destination. A signed-in person without a finished profile is sent through onboarding before protected routes open. Demo role switching is shown only with local emulators. [Sign-in](../src/pages/LoginPage.tsx), [guards](../src/components/guards/RouteGuards.tsx)
- Onboarding asks for birth date before creating an account, stops an under-13 applicant, then collects account details, name and optional phone, interests, optional skills, optional weekly availability, and optional ZIP. A human check completes the profile. The draft stays in page state until submission; the final screen offers matching shifts. [Onboarding](../src/pages/OnboardingPage.tsx)
- The profile page edits name, interests, skills, availability, phone, and ZIP. It sends only changed fields and confirms the saved result. Birth date is read-only for the volunteer. A volunteer can opt into being discoverable for invitations from new organizations. [Profile](../src/pages/volunteer/ProfilePage.tsx)
- The site provides 100%, 125%, and 150% text sizes, high contrast, and reduced motion. Preferences apply throughout the interface and synchronize with the profile when signed in. [Display controls](../src/components/DisplayPreferences.tsx), [tokens](../src/styles/tokens.css)
- A storage notice explains essential sign-in and display storage. Privacy, Terms, and Accessibility pages are public. [Notice](../src/components/CookieConsent.tsx), [legal routes](../src/router.tsx)

## 4. Shift scheduling

### Booking one shift

- The action states distinguish signed out, available, full, waitlist available, signed up, waitlisted, cancelled, too young, unverified organization for a minor, shift started, and shift cancelled. A pending action waits for the server and then the live data snapshot; there is no optimistic booking. [Action](../src/components/shifts/SignupAction.tsx), [state matrix](../src/lib/signupButtonState.ts)
- Signup is transactional. A free seat confirms a person; an eligible full shift offers an ordered waitlist. The waitlist is limited, closes two hours before start, and fills released seats in order. A free seat after cutoff can still accept a walk-up before start. Cancelling a confirmed place can promote the next person. [Signup](../functions/src/shifts/signupCore.ts), [promotion](../functions/src/shifts/promotion.ts)
- A volunteer cannot make a new overlapping commitment. Explore and the shift page show the existing commitment and link to it; the server checks all active bookings, including waitlist places, inside the signup transaction. Simultaneous requests by one person are serialized. Two shifts that touch exactly at their endpoints are allowed. [Conflict rule](../shared/src/scheduleConflict.ts), [signup transaction](../functions/src/shifts/signupCore.ts)
- Each signup has a deterministic document ID, so retrying a request cannot create a duplicate place. Cancellation is explicit; a previously cancelled signup cannot silently be recreated. Late cancellation and late-promotion release rules affect the reliability record. [Signup state machine](../shared/src/stateMachine.ts)
- My Shifts leads with the next shift and its check-in action, then lists upcoming and past activity. A volunteer can cancel, see waitlist promotion, request attendance review after a no-show, and download a calendar file for an active signup. [My Shifts](../src/pages/MyShiftsPage.tsx)
- An `.ics` export uses the organization's IANA time zone, a stable event ID, and sequence numbers for updates. A cancelled signup offers a cancellation file; calendar clients may still require deleting the original event manually. [Calendar file](../shared/src/ics.ts), [button](../src/components/shifts/CalendarButton.tsx)

### Recurring work

- Coordinators can create and edit a recurring series. Tandem materializes dated shifts ahead of time and extends that window through the scheduled job. Each dated shift keeps its own capacity, roster, and status. [Series form](../src/components/org/SeriesForm.tsx), [materialization](../functions/src/series)
- Volunteers can sign up for all currently materialized dates at once. The result lists confirmed, waitlisted, and skipped dates. When the organization adds later dates, the volunteer explicitly extends their series signup; it does not silently book future dates. [Series signup](../src/components/shifts/SeriesSignupPanel.tsx)

## 5. Attendance and hours

- A coordinator starts a kiosk for one shift. The tablet switches to a scoped kiosk session and shows a six-digit code that rotates every 30 seconds, a countdown, QR when the browser has a secure context, and arrivals that update live. The coordinator's roster updates from the same signup data. [Kiosk](../src/pages/KioskPage.tsx), [code](../functions/src/kiosk/kioskCode.ts)
- A signed-up volunteer can enter the code on a phone or scan the QR. Check-in opens 30 minutes before the shift and closes at its end. Check-out opens 15 minutes after check-in and remains available for 30 minutes after shift end. The server verifies the code, account, shift, and time window. [Phone check-in](../src/components/checkin/CheckInPanel.tsx), [operations](../functions/src/ops/checkIn.ts)
- Check-out writes the attendance result and an hours log from server time. Minutes are rounded to the nearest 15 and limited by the shift's actual window. Kiosk hours are approved automatically except a zero-minute result, which goes to coordinator review. A volunteer receives a clear completion state. [Check-out](../functions/src/ops/checkOut.ts), [hours math](../shared/src/hours.ts)
- At the end of a shift, a coordinator can finalize it; the scheduled job can do the same after the grace period. The process marks no-shows or excused cases and completes eligible check-ins. Coordinators can correct attendance with a required note. A volunteer can ask for review within 30 days of a no-show. [Finalize](../functions/src/ops/finalizeShift.ts), [attendance](../src/components/org/AttendanceEditor.tsx)
- A volunteer can submit hours for work done outside Tandem. Those entries start pending and an organization coordinator approves or rejects them with a reason. The dashboard groups pending logs, exceptions, and disputes in a live Needs attention queue, including bulk approval of eligible entries for a shift. [Outside hours](../src/pages/volunteer/ManualHoursPage.tsx), [Needs attention](../src/components/org/NeedsAttention.tsx)
- A reliability record reflects attended, missed, excused, and late-cancelled commitments; it is shown to the volunteer with explanatory text and used by coordinator matching. Newly joined volunteers get a neutral starting weight. [Reliability](../shared/src/reliability.ts), [track record](../src/components/impact/TrackRecord.tsx)

## 6. Impact and proof

- Impact shows approved hours from live logs, progress toward 25, 50, and 100 hour milestones, a service streak, a track record, letters, and routes to outside hours and reports. Milestone cards can be downloaded and, where supported, shared. The interface does not invent community impact totals. [Impact](../src/pages/ImpactPage.tsx), [milestones](../src/components/impact/Milestones.tsx)
- A volunteer can preview eligible hours, choose an organization or all verified organizations and a date range, then issue a private PDF letter. Hours at unverified organizations are excluded and shown separately. The letter includes a verification code and QR. A new letter for the same scope supersedes the old one; a later hours change can also supersede it. [Letter builder](../src/components/impact/LetterBuilder.tsx), [issue operation](../functions/src/ops/issueLetter.ts)
- Anyone can enter a code at `/verify` or open `/verify/:code` to see the letter's current valid, superseded, revoked, or not-found state, along with a privacy-limited name, hours, period, and organizations. The public page is the source of truth if a PDF has been altered. [Verification](../src/pages/VerifyPage.tsx)
- An authorized organization owner can view letters containing its hours and revoke one with a reason. An admin can revoke by code. PDF downloads use short-lived authorized links. [Organization letters](../src/components/org/OrgLettersPanel.tsx), [PDF access](../functions/src/ops/getPdfUrl.ts)
- Volunteers can preview and generate their own hours report. Coordinators can do the same for organization participation. Both support a date range, section choices, one of six preset themes, server-generated PDF, and CSV column selection/export. Volunteer sections include totals, hours by organization and month, shift list, and milestones. Organization sections include signups, attendance, approved hours, opportunities, monthly trends, top volunteers, and reliability distribution. [Report builder](../src/components/reports/ReportBuilder.tsx), [report data](../shared/src/reportData.ts)

## 7. Organization work

- An adult with a verified email can register an organization with its mission, causes, EIN, address, contact details, and time zone. New organizations await admin verification. Editing the name or EIN resets verification and refreshes public copies and minor contact handling. Owners can archive an eligible organization or delete one only before activity exists. [Registration](../src/pages/org/OrgRegisterPage.tsx), [settings](../src/pages/org/OrgSettingsPage.tsx)
- Owners can issue expiring invite codes, add coordinators through redemption, and remove members except the owner. Contact access is a separate permission. [Invites](../src/components/org/InvitesPanel.tsx), [members](../src/components/org/MembersPanel.tsx)
- Coordinators define reusable opportunities, then create dated shifts with time, capacity, location and requirements. They can edit future shifts, raise capacity, cancel shifts with a reason, and manage recurring series. Capacity changes can promote waitlisted people. Time changes update calendar sequence and send an in-app alert. [Shift creation](../src/pages/org/OrgShiftNewPage.tsx), [shift detail](../src/pages/org/OrgShiftDetailPage.tsx)
- A plain-language planner fills the structured shift form from a sentence. Its deterministic parser works without AI; an optional AI pass can improve the draft. Nothing is published until the coordinator reviews and saves the form. [Planner](../src/components/org/PlannerBox.tsx)
- The organization dashboard shows the next shift, live roster, signed-up and checked-in counts, upcoming shifts, Needs attention, attendance rate, and approved hours this month. Shift detail includes contact details only when authorized, attendance corrections, kiosk start, finalize, editing, and cancellation. [Dashboard](../src/pages/OrgDashboardPage.tsx), [roster](../src/components/org/ShiftAttendanceRoster.tsx)
- Coordinators can rank people who served with the organization or opted into discovery. The list gives a match score and reasons without exposing private identifiers or home locations. Selected people receive in-app shift invitations through short-lived opaque references. [Ranking UI](../src/components/org/RankedVolunteersPanel.tsx), [ranking operation](../functions/src/ops/rankVolunteers.ts)
- Organization teams can draft, publish, edit, and delete curated collections of opportunities and organizations. Admins can manage app-wide collections. Published collections appear on Explore. [Organization collections](../src/pages/org/OrgCollectionsPage.tsx), [admin collections](../src/components/admin/AdminCollectionsPanel.tsx)
- An organization may respond to a volunteer's public review, edit that response, or remove it. [Review response](../src/components/reviews/ReviewItem.tsx)

## 8. Messages, help, and AI

- In-app alerts cover waitlist promotion or closure, shift change or cancellation, hours approval or rejection, attendance changes, letter status, review requests, and shift invitations. A header bell shows recent alerts and unread count; `/me/notifications` groups the full list by day and supports marking items read. Upcoming-shift reminders are computed from the schedule. Delivery is in-app only. [Notifications](../src/pages/NotificationsPage.tsx), [notification types](../shared/src/notifications.ts)
- The Help Center has searchable Markdown articles, topic browsing, and route-aware suggestions. A Quick help panel opens from the site shell; `?` opens help and Ctrl/Cmd+K opens a command palette for role-allowed destinations, help articles, organizations, and Explore search. [Help](../src/pages/HelpPage.tsx), [palette](../src/components/palette/CommandPalette.tsx)
- A signed-in person can ask the help assistant a question. It retrieves relevant articles and returns an answer with article links; if AI is disabled, unavailable, limited, or invalid, the article-based fallback remains available. The provider and model are server-configured. The model receives help content and route context, not private profile data, and it has no action tools. [Assistant](../functions/src/ops/askAssistant.ts), [retrieval](../functions/src/ai/retrieval.ts)
- AI use is limited per person and across the site, and both AI inputs have a length limit. The available providers are Anthropic and OpenRouter, selected on the server; provider keys are not browser variables. [AI settings](../functions/src/ai/aiSettings.ts), [usage limits](../functions/src/ai/aiUsage.ts)
- The optional AI shift planner has the same deterministic fallback. It suggests form fields; it cannot create or publish a shift itself. Volunteer ranking is deterministic rather than model-generated. [AI planner](../functions/src/ops/shiftPlannerParse.ts)

## 9. Administration and demo

- Admins can verify or unverify organizations, inspect job runs, run due jobs on demand, revoke a letter by code, and manage app-wide collections. [Admin](../src/pages/AdminPage.tsx)
- The guarded demo mode can advance or reset a shared clock, run due jobs, and reseed accounts and example data. The clock keeps the kiosk, phone, laptop, and background jobs in the same demo time. Demo controls appear only when the environment permits them. [Demo controls](../src/components/org/DemoControls.tsx), [runbook](DEMO.md)
- A single scheduled job handles waitlist cutoff, finalization, recurring-series extension, and pending contact-refresh repair. It takes a lease to avoid overlapping runs and records job history. Triggers recompute volunteer statistics and supersede affected letters. [Jobs](../functions/src/jobs/runDueJobs.ts), [triggers](../functions/src/triggers)
- A health endpoint reports service status and job recency for deployment checks. [Health](../functions/src/index.ts)

## 10. Trust, privacy, and quality

- Firebase Authentication identifies users. Firestore and Storage rules default to denial and scope records by owner, organization membership, role, or one-shift kiosk token. Most trusted writes go through validated callable Functions; only narrow personal settings, saved items, and review operations use allowed client writes. App Check can protect deployed callable and public verification traffic when configured. [Rules](../firestore.rules), [callable pipeline](../functions/src/lib/defineCallable.ts)
- Minors must be at least 13. Under-18 volunteers cannot join shifts at unverified organizations, and their contact snapshots are hidden from unverified teams. Public reviewer and verification names use a first name and last initial, or the chosen anonymous review label. [Minor rules](../functions/src/ops/completeProfile.ts), [contact refresh](../functions/src/orgs/contactRefreshJob.ts)
- Signup, waitlist, attendance, hours, and letters have explicit server-side state checks. Create operations use stable request nonces or document IDs for retries. Kiosk codes rotate, check-in attempts and invites are rate limited, and the human check protects profile completion. Secrets stay on the server. [Shared contracts](../shared/src/ops.ts), [error catalog](../shared/src/errorCatalog.ts)
- Time is stored as UTC Firestore timestamps and displayed in each organization's IANA zone. Calendar exports include that zone. Empty, loading, error, and success states are written in plain language, with request IDs and help links for operational errors. [Time rules](../shared/src/clock.ts), [error UI](../src/components/errors/ErrorNotice.tsx)
- The site has visible keyboard focus, skip navigation, labeled forms, screen-reader announcements, reduced-motion behavior, large-text and high-contrast modes. Static public pages have titles, descriptions, canonical and social metadata; organization pages add structured data. [Accessibility](../src/pages/legal/AccessibilityPage.tsx), [SEO](../src/components/seo/RouteHead.tsx)
- Hosting sends a content security policy and other browser security headers. The build generates `robots.txt` and a public-page sitemap. Photo credits are maintained in the repository rather than displayed over task content. [Hosting](../firebase.json), [sitemap](../src/lib/seo/sitemap.ts), [credits](ASSET_CREDITS.md)
- TypeScript schemas are shared by client and server. Tests cover domain logic, React components, Firestore and Storage rules, Functions against emulators, and browser flows including the three-device check-in. CI runs on Ubuntu and Windows; secret scanning runs on Ubuntu. [Test setup](../vitest.config.ts), [CI](../.github/workflows/ci.yml)

## 11. Data kept by Tandem

| Record | Purpose |
|---|---|
| Organizations, members, invites | Public profile, verification, team permissions, invitation codes. |
| Opportunities, instances, series | Reusable work, dated shifts, recurring rules, capacity, and schedule. |
| Signups, signup contacts, series signups | Bookings, ordered waitlist, attendance history, protected roster contact, series coverage. |
| Hours logs and volunteer statistics | Approved, pending, or rejected time; totals, milestones, streak, reliability. |
| Letters and verification records | Private PDF metadata and public current-status proof. |
| Reports | Generated PDF metadata and authorization. |
| User profiles, saved items, notifications | Private matching preferences, bookmarks, and in-app updates. |
| Collections and reviews | Curated discovery and completed-shift feedback. |
| System records | Rate limits, AI usage, kiosk secrets, job leases/runs, and guarded demo clock. |

The schemas and access rules are in [SPEC.md §3](SPEC.md#data-model), [shared collections](../shared/src/collections.ts), and [Firestore rules](../firestore.rules).

## 12. Route index

This table lists every app route. A `:name` segment is a record ID or code. The same account can be a volunteer and a coordinator; its organization routes depend on membership.

| Route | Access | Main purpose |
|---|---|---|
| `/` | Public | Tandem landing page and cause entry points. |
| `/explore` | Public | Search, filter, map, schedule, recommendations, and collections. |
| `/opportunity/:instanceId` | Public | Shift facts, signup, and recurring-series signup. |
| `/organizations/:orgId` | Public | Organization details, shifts, and reviews. |
| `/collections/:collectionId` | Public if published | One curated collection; authorized team members can preview a draft. |
| `/help`, `/help/:slug` | Public | Help search, topics, and individual articles. |
| `/verify`, `/verify/:code` | Public | Current status of a letter code. |
| `/login` | Public | Sign in, with safe return path. |
| `/onboarding` | Public or signed in | Age gate, account/profile completion, and suggested shifts. |
| `/me/shifts` | Completed profile | Upcoming and past shifts, check-in, cancellations, calendar. |
| `/me/notifications` | Completed profile | Full in-app alert list. |
| `/me/saved` | Completed profile | Saved opportunities and organizations. |
| `/me/profile` | Completed profile | Volunteer profile and invitation discovery setting. |
| `/checkin` | Completed profile | Code or QR check-in and check-out. |
| `/impact` | Completed profile | Hours, milestones, record, and letters. |
| `/impact/report` | Completed profile | Volunteer report builder. |
| `/impact/hours/new` | Completed profile | Submit outside hours for review. |
| `/join` | Completed profile | Redeem an organization invite. |
| `/org/register` | Completed profile, adult | Register a nonprofit. |
| `/org/:orgId/dashboard` | Organization member | Live operations overview. |
| `/org/:orgId/shifts` | Organization member | Upcoming and past organization shifts. |
| `/org/:orgId/shifts/new` | Organization member | Create an opportunity, shift, or recurring series. |
| `/org/:orgId/shifts/:instanceId` | Organization member | Roster, kiosk, attendance, and shift management. |
| `/org/:orgId/series/:seriesId` | Organization member | Recurring-series dates and rule. |
| `/org/:orgId/reports` | Organization member | Participation report builder. |
| `/org/:orgId/collections` | Organization member | Organization-curated collections. |
| `/org/:orgId/settings` | Organization member | Profile, verification, people, invites, letters. Owner-only actions remain guarded. |
| `/org/:orgId/kiosk/:instanceId` | Coordinator start, then scoped kiosk token | One shift's code, QR, countdown, and arrivals, outside the normal shell. |
| `/admin` | Administrator | Verification, jobs, letter moderation, collections, demo controls. |
| `/privacy`, `/terms`, `/accessibility` | Public | Legal and accessibility information. |
| Unmatched path | Public | Friendly not-found page. |

All route guards and lazy-loaded pages are registered in [router.tsx](../src/router.tsx). The letter builder is part of `/impact`; there is no separate `/impact/letters/new` route in the current app.

## 13. Server operation index

These are the registered callable operations. Each call validates input and output with shared schemas, applies role and resource checks, and returns a request ID. The full input, output, error, and transition contract belongs in [SPEC.md §5](SPEC.md#api).

| Endpoint | Operations used by product features |
|---|---|
| `volunteer` | `completeProfile`, `updateProfile`, `signup`, `cancelSignup`, `signupSeries`, `extendSeriesSignup`, `submitManualHours`, `requestAttendanceReview`, `issueLetter`, `generateVolunteerReport`, `getPdfUrl`, `markNotificationsRead`. |
| `coordinator` | `registerOrganization`, `updateOrganization`, `createInvite`, `redeemInvite`, `removeMember`, `upsertOpportunity`, `createInstance`, `updateInstance`, `cancelInstance`, `upsertSeries`, `extendSeries`, `startKiosk`, `finalizeShift`, `setAttendance`, `approveHours`, `rejectHours`, `revokeLetter`, `generateOrgReport`, `getOrgReportUrl`, `rankVolunteers`, `inviteVolunteers`, `upsertCollection`, `publishCollection`, `deleteCollection`. |
| `kiosk` | `issueKioskCode`, `checkIn`, `checkOut`. |
| `admin` | `verifyOrganization`, `runDueJobs`, `setDemoClock`, `resetDemoData`, `upsertCollection`, `publishCollection`, `deleteCollection` for app-wide collections. |
| `ai` | `askAssistant`, `shiftPlannerParse`. |

Each endpoint also has a health `ping` operation. The endpoint lists are in [functions/src/endpoints](../functions/src/endpoints); the typed client map is in [api.ts](../src/lib/api.ts).

## 14. Explicit boundaries and known gaps

- Tandem does not send email, SMS, or push alerts. Notifications live in the app.
- There is no offline check-in, mobile app, subscribed calendar feed, volunteer-authored collection, or public volunteer profile.
- Volunteers cannot change their birth date in the profile, and the current app has no admin correction screen.
- A new booking is checked for schedule clashes. A coordinator moving an already booked shift can still create a clash; the time-change alert tells affected volunteers about the move.
- Calendar cancellation files are best effort across third-party calendar apps.
- AI and map features depend on server configuration and a public map token, respectively; their deterministic or list alternatives stay available.
- The full live onboarding flow depends on the Cloudflare Turnstile widget accepting the deployed hostname. That external hostname configuration was not retested for this inventory.
- The photo library illustrates causes and general pages. Stock images are not assigned as evidence of a named shift or organization. [Design](DESIGN.md), [credits](ASSET_CREDITS.md)

For every callable input, output, permission, and state transition, use [SPEC.md §5](SPEC.md#api). For competition scoring evidence, use [RUBRIC_MAP.md](RUBRIC_MAP.md).
