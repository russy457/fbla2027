/**
 * PrivacyPage.tsx
 * Route "/privacy" (SPEC 9.1). Plain-language privacy policy for a student
 * FBLA project. Data retention and export are manual (SPEC 1.3), so this page
 * is where they are documented.
 */
import type { ReactElement } from "react";
import { LegalDocument, type LegalSection } from "@/components/legal/LegalDocument";
import { APP_NAME } from "@/lib/brand";
import { LEGAL_CONTACT_PLACEHOLDER } from "@/lib/legal";

const SECTIONS: ReadonlyArray<LegalSection> = [
  {
    id: "who-we-are",
    heading: "Who we are",
    body: (
      <>
        <p>
          {APP_NAME} is a student project built by a Future Business Leaders of America (FBLA) team for a
          competition. The organizations and shifts in the demo are fictional. This policy explains what the app
          stores and why, in plain words. It is written by students and is not legal advice.
        </p>
      </>
    )
  },
  {
    id: "what-we-collect",
    heading: "What we collect",
    body: (
      <>
        <ul>
          <li>Account details: your email address and your name.</li>
          <li>Your birth date, so we can make sure every user is 13 or older and apply teen protections.</li>
          <li>Optional profile details: phone number, ZIP code, interests, skills, and the times you are usually available.</li>
          <li>Shift activity: the shifts you sign up for, check-in and check-out times, and your hours logs.</li>
          <li>Letters: hour verification letters you create, including their verification codes.</li>
        </ul>
        <p>We never store your exact address. Your ZIP code is turned into a rough area of about 5 km.</p>
      </>
    )
  },
  {
    id: "why",
    heading: "Why we collect it",
    body: (
      <ul>
        <li>To let you sign up for shifts, check in, and keep a record of your hours.</li>
        <li>To let organizations run their shifts and contact volunteers when plans change.</li>
        <li>To create hour letters that schools and others can verify.</li>
        <li>To suggest shifts that match your interests, skills, and availability.</li>
        <li>To keep the app safe, including age checks and limits that stop abuse.</li>
      </ul>
    )
  },
  {
    id: "who-sees-what",
    heading: "Who sees what",
    body: (
      <ul>
        <li>
          Other users see only your display name (first name and last initial), your badges, and your total
          approved hours.
        </li>
        <li>
          Coordinators see the roster for their own shifts, with names and a contact snapshot (full name, email, and
          phone if you gave one).
        </li>
        <li>If you are under 18, coordinators at organizations that are not verified do not see your contact details.</li>
        <li>
          Anyone with a letter's code can open the public verify page, which shows the name on the letter, the
          hours, the date range, and the organization names. It shows nothing else about you.
        </li>
        <li>We do not sell your data and we do not show ads.</li>
      </ul>
    )
  },
  {
    id: "minors",
    heading: "Minors and age requirements",
    body: (
      <>
        <p>You must be 13 or older to use {APP_NAME}.</p>
        <ul>
          <li>If you are under 13, sign-up is refused and no account is created.</li>
          <li>If we learn that an account belongs to someone under 13, we delete it and its data.</li>
          <li>
            Teens aged 13 to 17 get extra protections: they cannot sign up for shifts at unverified organizations,
            and their contact details are hidden from those organizations.
          </li>
        </ul>
        <p>
          We encourage teens to involve a parent or guardian when choosing shifts and to tell them where and when
          they will volunteer.
        </p>
      </>
    )
  },
  {
    id: "ai-assistant",
    heading: "The help assistant",
    body: (
      <p>
        The help assistant uses an AI model from Anthropic to answer questions. It receives only the text of our
        help articles, the name of the page you are on, and the question you type. It does not receive your profile,
        your shifts, or your hours. Please do not type personal details into your question.
      </p>
    )
  },
  {
    id: "storage",
    heading: "Cookies and local storage",
    body: (
      <ul>
        <li>Your display preferences (text size, contrast, and motion) are saved in your browser's local storage.</li>
        <li>Firebase Authentication keeps you signed in by storing a session in your browser.</li>
        <li>The storage notice remembers that you dismissed it.</li>
        <li>
          If you open the optional map on Explore, Mapbox loads the map and may store an anonymous identifier in your
          browser. The map shows organizations' approximate areas only, never volunteers' locations.
        </li>
        <li>We do not use advertising or tracking cookies.</li>
      </ul>
    )
  },
  {
    id: "providers",
    heading: "Service providers",
    body: (
      <ul>
        <li>Google Firebase stores app data, runs our server code, and handles sign-in.</li>
        <li>Cloudflare Turnstile checks that sign-ups come from a person, not a bot.</li>
        <li>Anthropic provides the AI model behind the help assistant's answers.</li>
        <li>Mapbox draws the optional Explore map when you choose to open it.</li>
      </ul>
    )
  },
  {
    id: "retention",
    heading: "How long we keep data",
    body: (
      <>
        <p>Retention and export are handled by hand, on request. There is no automatic deletion schedule yet.</p>
        <ul>
          <li>We delete your account and its data when you ask us to.</li>
          <li>Hours logs and letters are kept while your account exists, so your letters stay verifiable.</li>
          <li>A letter that was revoked stays marked as revoked, so nobody can rely on it by mistake.</li>
          <li>Rate-limit and usage counters are short-lived and reset within a day.</li>
        </ul>
      </>
    )
  },
  {
    id: "your-choices",
    heading: "Deleting or exporting your data",
    body: (
      <p>
        To ask for a copy of your data or to delete your account, reach out to {LEGAL_CONTACT_PLACEHOLDER}. A team
        member will handle the request by hand and confirm when it is done.
      </p>
    )
  },
  {
    id: "security",
    heading: "Security",
    body: (
      <p>
        Data is sent over encrypted connections. Access rules on the server limit who can read each record, and
        sensitive actions run only on the server. No system is perfectly secure, so please use a strong password
        that you do not use anywhere else.
      </p>
    )
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: <p>If this policy changes, we will update it here and change the "Last updated" date at the top.</p>
  }
];

const PrivacyPage = (): ReactElement => (
  <LegalDocument
    title="Privacy policy"
    intro={<p>What {APP_NAME} stores about you, who can see it, and how to ask us to delete it.</p>}
    sections={SECTIONS}
  />
);

export default PrivacyPage;
