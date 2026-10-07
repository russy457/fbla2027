# Firebase setup status

Updated 2026-10-07. This project is separate from previous FBLA projects.

| Item | State |
|---|---|
| Firebase project | `fbla2027-ethanteng`, display name **fbla 2027** |
| Web app | Registered as **fbla 2027** |
| Pricing plan | Spark. No billing account linked; no upgrade is planned. |
| Cloud Firestore | `(default)` Native database in `us-central1` |
| Firestore security rules and indexes | Deployed from `firestore.rules` and `firestore.indexes.json` |
| Authentication | Email/Password enabled on Spark through `firebase deploy --only auth`; four fictional demo accounts seeded. |
| Hosting | Browsing preview deployed at `https://fbla2027-ethanteng.web.app` on Spark. |
| Cloud Functions and Storage | Not deployed. Firebase requires Blaze for Functions deployment and Storage access. |

The project console is [Firebase project overview](https://console.firebase.google.com/project/fbla2027-ethanteng/overview). Cloud Firestore now contains 140 fictional seed documents. A live signup was verified through the local callable emulator and appeared in the cloud `signups` collection. Private demo passwords are saved only in `.cloud-demo-accounts.local` on the presentation laptop.

The hosted site is a browsing preview: public opportunities load from cloud Firestore, and new account creation is disabled so no one starts an account that cannot be completed. It is built with `npm run build:hosting` and deployed with `npm run deploy:hosting`. The current app sends trusted writes to Cloud Functions. On Spark, `npm run demo:cloud` runs those Functions on the presentation laptop while the browser uses cloud Auth and Firestore. A local callable signup changes the live cloud `signups` document and shift seat count. Cloud Storage remains unavailable, so the app uses the local Storage emulator in this mode. Firestore triggers and scheduled Functions do not run for cloud writes. The full hosted signup, kiosk, hours, reports, and AI workflows **cannot run on Spark** without a backend elsewhere; no Cloud Functions are deployed. No billing link or paid service has been enabled.

The web app's Firebase configuration is public by design; provider secrets belong on the server, never in a `VITE_` variable. Sources: [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Authentication](https://firebase.google.com/docs/auth/), and [Cloud Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
