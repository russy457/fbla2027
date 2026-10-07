/**
 * TermsPage.tsx
 * Route "/terms" (SPEC 9.1). Plain-language terms of use for a student FBLA
 * project: acceptable use, honest hours, coordinator duties, what
 * verification means, minors, termination, and AI answers.
 */
import type { ReactElement } from "react";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { APP_NAME } from "@/lib/brand";

const SECTIONS: ReadonlyArray<LegalSection> = [
  {
    id: "about",
    heading: "About these terms",
    body: (
      <p>
        {APP_NAME} is a student project built by an FBLA team for a competition. The organizations in the demo are
        fictional. By using the app you agree to these terms. They are written by students and are not legal advice.
      </p>
    )
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <ul>
        <li>Use your real name and birth date, and keep your account to yourself.</li>
        <li>Be respectful to volunteers, coordinators, and the people organizations serve.</li>
        <li>Do not try to break, overload, or get around the app's security or limits.</li>
        <li>Do not use the app to collect other people's personal details.</li>
      </ul>
    )
  },
  {
    id: "hours",
    heading: "Accurate hours",
    body: (
      <>
        <p>
          Check in when you arrive and check out when you leave. Hours count only after a coordinator approves them.
        </p>
        <p>
          Faking check-ins, sharing check-in codes with people who are not there, or claiming hours you did not
          serve is fraud. If that happens, the hours are removed and any letter that included them is revoked.
          Anyone checking a revoked letter will see that it was revoked.
        </p>
      </>
    )
  },
  {
    id: "coordinators",
    heading: "Coordinator responsibilities",
    body: (
      <ul>
        <li>Post shifts with accurate times, locations, age limits, and descriptions.</li>
        <li>Record attendance and approve or reject hours honestly and promptly.</li>
        <li>Use volunteer contact details only to coordinate the shifts they signed up for.</li>
        <li>Follow your organization's own safety rules, especially for volunteers under 18.</li>
      </ul>
    )
  },
  {
    id: "verification",
    heading: "What \"verified organization\" means",
    body: (
      <p>
        A verified badge means an app admin reviewed the organization's details. It is not a background check, a
        safety inspection, or an endorsement. Use your own judgment before volunteering anywhere.
      </p>
    )
  },
  {
    id: "no-guarantee",
    heading: "No guarantee",
    body: (
      <p>
        The app is provided as it is, as a student project. Shifts can change or be cancelled, and the app may have
        bugs or be unavailable. We cannot promise that any school or program will accept a letter from the app.
      </p>
    )
  },
  {
    id: "minors",
    heading: "Minors",
    body: (
      <p>
        You must be 13 or older to use {APP_NAME}. If you are 13 to 17, a parent or guardian should know that you
        use the app and where and when you plan to volunteer.
      </p>
    )
  },
  {
    id: "termination",
    heading: "Account termination",
    body: (
      <p>
        You can ask us to delete your account at any time. We may suspend or delete accounts that break these
        terms, give false information, or put other people at risk.
      </p>
    )
  },
  {
    id: "ai-answers",
    heading: "AI answers",
    body: (
      <p>
        The help assistant uses AI and its answers can be wrong. Check important details against the help articles
        or with the organization running the shift.
      </p>
    )
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: <p>If these terms change, we will update them here and change the "Last updated" date at the top.</p>
  }
];

const TermsPage = (): ReactElement => (
  <LegalDocument
    title="Terms of use"
    intro={<p>The ground rules for volunteers and coordinators using {APP_NAME}.</p>}
    sections={SECTIONS}
  />
);

export default TermsPage;
