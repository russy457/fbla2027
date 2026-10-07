#!/usr/bin/env node
/** End-to-end local check: Auth -> callable signup -> Firestore documents. */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "demo-fbla2027";
const INSTANCE_ID = "pantry-family-market-upcoming";
const UID = "demo-minor";
const SIGNUP_ID = `${INSTANCE_ID}_${UID}`;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const functionsPort = process.env.E2E_FUNCTIONS_PORT;

if (!authHost?.endsWith(":19099") || !firestoreHost?.endsWith(":18080") || functionsPort !== "15001") {
  console.error("verify:signup runs only inside the isolated demo emulator suite on ports 19099, 18080, and 15001.");
  process.exit(1);
}

// The contact snapshot is deliberately private under Firestore rules. Read it
// with the Admin SDK, as the seed and Cloud Function do, rather than making an
// unauthenticated REST request that the rules correctly reject.
const db = getFirestore(initializeApp({ projectId: PROJECT_ID }, "verify-signup"));

const readJson = async (response, label) => {
  const body = await response.json();
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
};

const firestoreDocument = async (path) => {
  const snapshot = await db.doc(path).get();
  if (!snapshot.exists) throw new Error(`Firestore ${path} does not exist.`);
  return snapshot.data();
};

const signup = async (idToken) => {
  const body = await readJson(
    await fetch(`http://127.0.0.1:${functionsPort}/${PROJECT_ID}/us-central1/volunteer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: { op: "signup", instanceId: INSTANCE_ID } })
    }),
    "volunteer.signup"
  );
  if (body.result?.ok !== true) throw new Error(`volunteer.signup returned ${JSON.stringify(body)}`);
  return body.result.data;
};

try {
  const auth = await readJson(
    await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "minor@demo.fbla2027.test", password: "fbla2027-demo-2027", returnSecureToken: true })
    }),
    "Auth sign-in"
  );
  if (auth.localId !== UID || !auth.idToken) throw new Error("Auth did not return the seeded volunteer account.");

  const before = await firestoreDocument(`instances/${INSTANCE_ID}`);
  const beforeCount = before.signupCount;
  if (!Number.isInteger(beforeCount)) throw new Error("Seeded shift is missing signupCount.");

  const first = await signup(auth.idToken);
  if (first.signupId !== SIGNUP_ID || first.status !== "confirmed") throw new Error(`Signup returned ${JSON.stringify(first)}`);

  const saved = await firestoreDocument(`signups/${SIGNUP_ID}`);
  if (saved.uid !== UID || saved.status !== "confirmed") {
    throw new Error("The confirmed signup was not saved to Firestore.");
  }
  const contact = await firestoreDocument(`signupContacts/${SIGNUP_ID}`);
  if (contact.uid !== UID) throw new Error("The signup contact snapshot was not saved to Firestore.");

  const after = await firestoreDocument(`instances/${INSTANCE_ID}`);
  if (after.signupCount !== beforeCount + 1) throw new Error("The shift seat count did not increase in Firestore.");

  const retry = await signup(auth.idToken);
  const afterRetry = await firestoreDocument(`instances/${INSTANCE_ID}`);
  if (retry.signupId !== SIGNUP_ID || afterRetry.signupCount !== beforeCount + 1) {
    throw new Error("Retry created a duplicate signup or took another seat.");
  }

  console.log(`verify:signup: PASS Auth sign-in, Functions response, Firestore signups/${SIGNUP_ID}, contact snapshot, seat count, and idempotent retry.`);
} catch (error) {
  console.error(`verify:signup: FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
