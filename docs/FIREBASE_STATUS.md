# Firebase setup status

Updated 2026-10-07. The competition project is `fbla2027-ethanteng` (display name **fbla 2027**).

| Service | State |
|---|---|
| Plan | Blaze, billing linked |
| Hosting | Production app at https://fbla2027-ethanteng.web.app |
| Authentication | Email and password enabled; four fictional demo accounts |
| Cloud Firestore | `(default)` in `us-central1`, with deployed rules and indexes |
| Cloud Functions | Six callable or HTTP endpoints, three Firestore triggers, and one scheduled job deployed in `us-central1` |
| Cloud Storage | Default bucket `fbla2027-ethanteng.firebasestorage.app`, with deployed rules |
| Turnstile | Browser site key and server verification configured for live onboarding |
| Help assistant | OpenRouter free model router configured server-side; article fallback remains available when the model is rate limited or fails |
| App Check | Client registration and enforcement are currently off. Turnstile protects profile completion. |

The live site uses cloud Auth, Firestore, Functions, and Storage without a running laptop. A cloud volunteer signup was verified in the `signups` and `signupContacts` collections, including its shift seat count. The seeded service letter PDF was uploaded to Storage. Private demo passwords are in `.cloud-demo-accounts.local` on the presentation laptop, not in the repository.

Run `npm run deploy:production` to rebuild and publish the web app. Deploy rules and Functions separately after backend changes. `npm run demo` remains the offline rehearsal path; `npm run demo:cloud` is a legacy hybrid mode and is no longer needed for the hosted presentation.

Secrets live in Firebase Secret Manager. The browser receives only public Firebase configuration, the Mapbox public token, and the Turnstile site key. Do not put OpenRouter or Turnstile secrets in a `VITE_` variable. If the demo data is reset, use the `resetPassword` field in `.cloud-demo-accounts.local` for all four demo accounts afterward.

[Firebase console](https://console.firebase.google.com/project/fbla2027-ethanteng/overview)
