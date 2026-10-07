/**
 * demoCast.ts
 * The fixed people, organizations, and opportunities of the demo seed
 * (SPEC#demo-accounts, 10.7). Everything here is fictional. Only the four
 * SPEC accounts get sign-in credentials; the "background" people exist so the
 * rosters, the one-seat-left shift, the full shift, and the waitlist look real.
 */
import type { Address, CauseArea } from "@fbla/shared";

export interface DemoPerson {
  readonly uid: string;
  readonly first: string;
  readonly last: string;
  /** Age in whole years on seed day. */
  readonly years: number;
}

export interface DemoAccount extends DemoPerson {
  /** Label printed in the credentials table. */
  readonly role: string;
  readonly email: string;
  readonly admin: boolean;
}

export const ADMIN: DemoAccount = { uid: "demo-admin", role: "Admin", email: "admin@demo.fbla2027.test", first: "Ada", last: "Admin", years: 30, admin: true };
export const COORDINATOR: DemoAccount = {
  uid: "demo-coordinator",
  role: "Owner / coordinator",
  email: "coordinator@demo.fbla2027.test",
  first: "Olivia",
  last: "Ortiz",
  years: 34,
  admin: false
};
export const VOLUNTEER: DemoAccount = {
  uid: "demo-volunteer",
  role: "Adult volunteer (19)",
  email: "volunteer@demo.fbla2027.test",
  first: "Jordan",
  last: "Rivera",
  years: 19,
  admin: false
};
export const MINOR: DemoAccount = { uid: "demo-minor", role: "Minor volunteer (15)", email: "minor@demo.fbla2027.test", first: "Sam", last: "Lee", years: 15, admin: false };

/** The four sign-in accounts of SPEC 10.7, in the order the credentials table prints them. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [ADMIN, COORDINATOR, VOLUNTEER, MINOR];

/** People without a sign-in: other orgs' owners and fellow volunteers on the rosters. */
export const BACKGROUND = {
  westsideOwner: { uid: "demo-bg-grace", first: "Grace", last: "Kim", years: 41 },
  trailsOwner: { uid: "demo-bg-marcus", first: "Marcus", last: "Bell", years: 38 },
  maria: { uid: "demo-bg-maria", first: "Maria", last: "Garcia", years: 27 },
  dev: { uid: "demo-bg-dev", first: "Dev", last: "Patel", years: 22 },
  ana: { uid: "demo-bg-ana", first: "Ana", last: "Torres", years: 45 },
  luis: { uid: "demo-bg-luis", first: "Luis", last: "Moreno", years: 31 }
} satisfies Record<string, DemoPerson>;

export interface DemoOrg {
  readonly id: string;
  readonly name: string;
  readonly mission: string;
  readonly causeAreas: CauseArea[];
  readonly ein: string;
  readonly address: Address;
  readonly contactEmail: string;
  readonly owner: DemoPerson;
  readonly verified: boolean;
}

/** Three San Antonio nonprofits (fictional): two verified, one unverified (SPEC 10.7). */
export const ORGS = {
  pantry: {
    id: "alamo-community-pantry",
    name: "Alamo Community Pantry",
    mission: "We sort, pack, and share donated groceries with San Antonio families every week. (Fictional demo organization.)",
    causeAreas: ["hunger-food-security", "community-development"],
    ein: "74-5550123",
    address: { line1: "418 Mission Commons Dr", city: "San Antonio", state: "TX", zip: "78204" },
    contactEmail: "hello@alamopantry.demo.fbla2027.test",
    owner: COORDINATOR,
    verified: true
  },
  reading: {
    id: "westside-reading-partners",
    name: "Westside Reading Partners",
    mission: "Volunteers read one on one with early readers at Westside elementary schools. (Fictional demo organization.)",
    causeAreas: ["education-youth"],
    ein: "74-5550456",
    address: { line1: "2210 Guadalupe Learning Ln", city: "San Antonio", state: "TX", zip: "78207" },
    contactEmail: "hello@westsidereading.demo.fbla2027.test",
    owner: BACKGROUND.westsideOwner,
    verified: true
  },
  trails: {
    id: "mission-trails-animal-rescue",
    name: "Mission Trails Animal Rescue",
    mission: "A small foster network that walks, socializes, and rehomes shelter dogs. Verification pending. (Fictional demo organization.)",
    causeAreas: ["animal-welfare"],
    ein: "74-5550789",
    address: { line1: "77 Espada Trail Rd", city: "San Antonio", state: "TX", zip: "78214" },
    contactEmail: "hello@missiontrails.demo.fbla2027.test",
    owner: BACKGROUND.trailsOwner,
    verified: false
  }
} satisfies Record<string, DemoOrg>;

export interface DemoOpportunity {
  readonly id: string;
  readonly org: DemoOrg;
  readonly title: string;
  readonly description: string;
  readonly causeArea: CauseArea;
  readonly minAge: number;
}

/**
 * One opportunity per cause area shown in the demo. Titles never contain one
 * another, so a text match on one (the e2e test does this) finds one shift.
 */
export const OPPORTUNITIES = {
  sortAndPack: {
    id: "pantry-sort-and-pack",
    org: ORGS.pantry,
    title: "Sort and pack food boxes",
    description: "Help sort donated groceries and pack family food boxes. Closed-toe shoes, please.",
    causeArea: "hunger-food-security",
    minAge: 13
  },
  familyMarket: {
    id: "pantry-family-market",
    org: ORGS.pantry,
    title: "Saturday family market",
    description: "Stock tables and help families choose fresh produce at our free weekend market.",
    causeArea: "hunger-food-security",
    minAge: 13
  },
  readingBuddies: {
    id: "westside-reading-buddies",
    org: ORGS.reading,
    title: "Read with second graders",
    description: "Read picture books one on one with second graders after school. Training is on site.",
    causeArea: "education-youth",
    minAge: 16
  },
  dogWalk: {
    id: "trails-dog-walk",
    org: ORGS.trails,
    title: "Walk and socialize shelter dogs",
    description: "Take foster dogs on short leash walks and help them get used to new people.",
    causeArea: "animal-welfare",
    minAge: 13
  }
} satisfies Record<string, DemoOpportunity>;
